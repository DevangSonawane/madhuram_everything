import React, { startTransition, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

import { api } from "@/lib/api";
import { withCommonCompanyHeader } from "@/lib/companyDefaults";
import { resolveProjectNumericId } from "@/lib/resolveProjectId";
import {
  hiranandaniApiToFormData,
  hiranandaniFormToApiPayload,
  lodhaApiToFormData,
  lodhaFormToApiPayload,
} from "@/lib/invoiceTransforms";

const todayDateOnly = () => new Date().toISOString().slice(0, 10);

const toLabel = (key) =>
  String(key || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const LODHA_HEADER_FIELDS = [
  "supplier_gstin",
  "pan_number",
  "pf_number",
  "esic_number",
  "ptr_number",
  "mlwf_number",
  "invoice_number",
  "invoice_date",
  "reverse_charge",
  "supplier_state_name",
  "supplier_state_code",
  "bill_to_name",
  "bill_to_address",
  "bill_to_gstin",
  "bill_to_state",
  "bill_to_state_code",
  "ship_to_name",
  "ship_to_address",
  "ship_to_gstin",
  "ship_to_state",
  "ship_to_state_code",
  "building_name",
  "ra_number",
  "work_description",
  "work_order_number",
  "work_order_date",
  "service_date_from",
  "service_date_to",
  "user_id",
  "user_name",
];

const LODHA_ITEM_FIELDS = [
  "description",
  "sac_code",
  "value_of_supply",
  "discount",
  "taxable_value",
  "cgst_rate",
  "cgst_amount",
  "sgst_rate",
  "sgst_amount",
  "line_total",
];

const LODHA_TOTAL_FIELDS = [
  "total_value_of_supply",
  "total_discount",
  "total_taxable_value",
  "total_cgst_amount",
  "total_sgst_amount",
  "total_amount",

  "total_invoice_amount_in_words",
  "total_amount_before_tax",
  "add_cgst",
  "add_sgst",
  "round_off",
  "total_amount_after_tax",
  "gst_on_reverse_charge",
  "e_and_oe",
];

const LODHA_DECLARATION_FIELDS = [
  "bank_details",
  "authorised_signatory",
];

const HIRA_HEADER_FIELDS = [
  "supplier_gstin",
  "invoice_number",
  "invoice_date",
  "user_id",
  "user_name",
];

const HIRA_BILLING_SHIPPING_FIELDS = [
  "buyer_name",
  "buyer_address",
  "buyer_state_name",
  "buyer_state_code",
  "buyer_gstin",
  "receiver_name",
  "receiver_address",
  "place_of_supply",
];

const HIRA_PROJECT_WORK_FIELDS = [
  "work_order_number",
  "work_order_date",
  "plant_name",
  "bill_no",
];

const HIRA_ITEM_FIELDS = [
  "description",
  "sac_code",
  "uom",
  "qty",
  "rate",
  "total_value_of_goods",
  "discount_if",
  "value_of_supply",
  "discount",
  "taxable_value",
  "cgst_rate",
  "cgst_amount",
  "sgst_rate",
  "sgst_amount",
  "igst_rate",
  "igst_amount",
  "cess_rate",
  "cess_amount",
  "line_total",
];

const HIRA_TOTAL_FIELDS = [
  "total_taxable_value",
  "total_cgst",
  "total_sgst",
  "total_igst",
  "total_cess",
  "total_value",
  "total_invoice_value",
  "total_invoice_value_words",
];

const HIRA_BANK_DECLARATION_FIELDS = [
  "declaration",
  "electronic_ref_number",
  "electronic_ref_date",
  "authorised_signatory",
];

function LodhaInvoiceForm({ onSave, initialHeader, autoDownload, initialData }) {
  const [header, setHeader] = useState(() => initialHeader || initialData?.header || {});
  const [totals, setTotals] = useState(() => initialData?.totals || {});
  const [bankDeclaration, setBankDeclaration] = useState(() => initialData?.bankDeclaration || {});
  const [items, setItems] = useState(() => (Array.isArray(initialData?.items) && initialData.items.length ? initialData.items : [{}]));
  useEffect(() => {
    // Download is intentionally disabled on create; only save actions remain.
    // Keep autoDownload prop for backward compatibility but do nothing.
  }, [autoDownload, bankDeclaration, header, items, totals]);

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="pb-4 border-b bg-muted/20">
          <CardTitle className="text-lg">Invoice Header</CardTitle>
          <CardDescription>Basic invoice and party details.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {LODHA_HEADER_FIELDS.map((key) => {
              const isLongText = key.includes("address");
              const value = header[key] ?? "";
              return (
                <div key={`lodha-header-${key}`} className={isLongText ? "sm:col-span-2" : ""}>
                  <div className="text-sm font-medium mb-1">{toLabel(key)}</div>
                  <Input
                    value={value}
                    onChange={(e) => setHeader((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={toLabel(key)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="pb-4 border-b bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Items</CardTitle>
              <CardDescription>Add line items for the invoice.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => setItems((prev) => [...prev, {}])}>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="min-w-[70px]">#</TableHead>
                  {LODHA_ITEM_FIELDS.map((key) => (
                    <TableHead key={`lodha-item-head-${key}`} className="min-w-[180px]">
                      {toLabel(key)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, index) => (
                  <TableRow key={`lodha-item-row-${index}`}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    {LODHA_ITEM_FIELDS.map((key) => (
                      <TableCell key={`lodha-item-${index}-${key}`}>
                        <Input
                          value={row?.[key] ?? ""}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((r, i) => (i === index ? { ...(r || {}), [key]: e.target.value } : r)),
                            )
                          }
                          placeholder={toLabel(key)}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={items.length <= 1}
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="pb-4 border-b bg-muted/20">
          <CardTitle className="text-lg">Totals / Summary</CardTitle>
          <CardDescription>Tax and invoice totals.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {LODHA_TOTAL_FIELDS.map((key) => {
              const isLongText = key.endsWith("_in_words");
              const value = totals[key] ?? "";
              return (
                <div key={`lodha-total-${key}`} className={isLongText ? "sm:col-span-2" : ""}>
                  <div className="text-sm font-medium mb-1">{toLabel(key)}</div>
                  <Input
                    value={value}
                    onChange={(e) => setTotals((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={toLabel(key)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="pb-4 border-b bg-muted/20">
          <CardTitle className="text-lg">Bank / Terms / Signature</CardTitle>
          <CardDescription>Bank details, terms and sign-off fields.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {LODHA_DECLARATION_FIELDS.map((key) => {
              const isLongText = key.includes("details") || key.includes("conditions");
              const value = bankDeclaration[key] ?? "";
              return (
                <div key={`lodha-dec-${key}`} className={isLongText ? "sm:col-span-2" : ""}>
                  <div className="text-sm font-medium mb-1">{toLabel(key)}</div>
                  <Input
                    value={value}
                    onChange={(e) => setBankDeclaration((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={toLabel(key)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => onSave?.({ header, items, totals, bankDeclaration }, { closeAfter: false })}
        >
          Save Draft (local)
        </Button>
        <Button type="button" onClick={() => onSave?.({ header, items, totals, bankDeclaration }, { closeAfter: true })}>
          Save Invoice
        </Button>
      </div>
    </div>
  );
}

function HiranandaniInvoiceForm({ onSave, initialValues, autoDownload }) {
  const [activeTab, setActiveTab] = useState("wo");
  const [header, setHeader] = useState(() => initialValues?.header || {});
  const [billingShipping, setBillingShipping] = useState(() => initialValues?.billingShipping || {});
  const [projectWork, setProjectWork] = useState(() => initialValues?.projectWork || {});
  const [totals, setTotals] = useState(() => initialValues?.totals || {});
  const [bankDeclaration, setBankDeclaration] = useState(() => initialValues?.bankDeclaration || {});
  const [items, setItems] = useState(() => (Array.isArray(initialValues?.items) && initialValues.items.length ? initialValues.items : [{}]));
  useEffect(() => {
    // Download is intentionally disabled on create; only save actions remain.
    // Keep autoDownload prop for backward compatibility but do nothing.
  }, [autoDownload, bankDeclaration, billingShipping, header, items, projectWork, totals]);

  const activeTabContent = (() => {
    switch (activeTab) {
      case "wo":
        return (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg">Invoice Header</CardTitle>
                <CardDescription>Supplier + invoice metadata.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {HIRA_HEADER_FIELDS.map((key) => {
                    const isLongText = key.includes("address");
                    const value = header[key] ?? "";
                    return (
                      <div key={`hira-header-${key}`} className={isLongText ? "sm:col-span-2" : ""}>
                        <div className="text-sm font-medium mb-1">{toLabel(key)}</div>
                        <Input
                          value={value}
                          onChange={(e) => setHeader((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={toLabel(key)}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg">Billing / Shipping Details</CardTitle>
                <CardDescription>Bill-to and ship-to party details.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {HIRA_BILLING_SHIPPING_FIELDS.map((key) => {
                    const isLongText = key.includes("address");
                    const value = billingShipping[key] ?? "";
                    return (
                      <div key={`hira-bs-${key}`} className={isLongText ? "sm:col-span-2" : ""}>
                        <div className="text-sm font-medium mb-1">{toLabel(key)}</div>
                        <Input
                          value={value}
                          onChange={(e) => setBillingShipping((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={toLabel(key)}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
              <CardHeader className="pb-4 border-b bg-muted/20">
                <CardTitle className="text-lg">Project / Work Details</CardTitle>
                <CardDescription>Project scope and work order details.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {HIRA_PROJECT_WORK_FIELDS.map((key) => {
                    const isLongText = key.includes("description");
                    const value = projectWork[key] ?? "";
                    return (
                      <div key={`hira-work-${key}`} className={isLongText ? "sm:col-span-2" : ""}>
                        <div className="text-sm font-medium mb-1">{toLabel(key)}</div>
                        <Input
                          value={value}
                          onChange={(e) => setProjectWork((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={toLabel(key)}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case "abstract":
        return (
          <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Items</CardTitle>
                  <CardDescription>Add line items for the invoice.</CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={() => setItems((prev) => [...prev, {}])}>
                  <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="min-w-[70px]">#</TableHead>
                      {HIRA_ITEM_FIELDS.map((key) => (
                        <TableHead key={`hira-item-head-${key}`} className="min-w-[180px]">
                          {toLabel(key)}
                        </TableHead>
                      ))}
                      <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row, index) => (
                      <TableRow key={`hira-item-row-${index}`}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        {HIRA_ITEM_FIELDS.map((key) => (
                          <TableCell key={`hira-item-${index}-${key}`}>
                            <Input
                              value={row?.[key] ?? ""}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((r, i) => (i === index ? { ...(r || {}), [key]: e.target.value } : r)),
                                )
                              }
                              placeholder={toLabel(key)}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={items.length <= 1}
                            onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      case "summ":
        return (
          <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg">Totals / Summary</CardTitle>
              <CardDescription>Tax and invoice totals.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {HIRA_TOTAL_FIELDS.map((key) => {
                  const isLongText = key.endsWith("_in_words");
                  const value = totals[key] ?? "";
                  return (
                    <div key={`hira-total-${key}`} className={isLongText ? "sm:col-span-2" : ""}>
                      <div className="text-sm font-medium mb-1">{toLabel(key)}</div>
                      <Input
                        value={value}
                        onChange={(e) => setTotals((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={toLabel(key)}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      case "sign":
        return (
          <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg">Bank / Declaration</CardTitle>
              <CardDescription>Bank details, terms, and sign-off fields.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {HIRA_BANK_DECLARATION_FIELDS.map((key) => {
                  const isLongText = key.includes("details") || key.includes("conditions");
                  const value = bankDeclaration[key] ?? "";
                  return (
                    <div key={`hira-bank-${key}`} className={isLongText ? "sm:col-span-2" : ""}>
                      <div className="text-sm font-medium mb-1">{toLabel(key)}</div>
                      <Input
                        value={value}
                        onChange={(e) => setBankDeclaration((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={toLabel(key)}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(value) => startTransition(() => setActiveTab(value))}>
        <TabsList className="flex flex-wrap justify-start">
          <TabsTrigger value="wo">Wo</TabsTrigger>
          <TabsTrigger value="abstract">Abstract</TabsTrigger>
          <TabsTrigger value="summ">Summ</TabsTrigger>
          <TabsTrigger value="sign">sign</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className={activeTab === "wo" ? "space-y-6" : undefined}>
          {activeTabContent}
        </TabsContent>
      </Tabs>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onSave?.(
              { header, billingShipping, projectWork, items, totals, bankDeclaration },
              { closeAfter: false },
            )
          }
        >
          Save Draft (local)
        </Button>
        <Button
          type="button"
          onClick={() =>
            onSave?.(
              { header, billingShipping, projectWork, items, totals, bankDeclaration },
              { closeAfter: true },
            )
          }
        >
          Save Invoice
        </Button>
      </div>
    </div>
  );
}

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const inBillingFlow = /\/billing\//.test(String(location?.pathname || ""));

  const template = useMemo(() => String(searchParams.get("template") || "").trim(), [searchParams]);
  const normalizedTemplate = template ? template.toLowerCase() : "";
  const templateLabel =
    normalizedTemplate === "lodha"
      ? "Lodha"
      : normalizedTemplate === "hiranandani"
        ? "Hira"
        : template || "Unknown";

  const autoDownload = useMemo(() => searchParams.get("autoDownload") === "1", [searchParams]);
  const invoiceNoParam = useMemo(() => String(searchParams.get("invoiceNo") || "").trim(), [searchParams]);
  const invoiceDateParam = useMemo(() => String(searchParams.get("invoiceDate") || "").trim(), [searchParams]);
  const invoiceIdParam = useMemo(() => String(searchParams.get("id") || "").trim(), [searchParams]);

  const initialHeader = useMemo(() => {
    const header = withCommonCompanyHeader({
      invoice_date: todayDateOnly(),
      work_order_date: todayDateOnly(),
      service_date_from: todayDateOnly(),
      service_date_to: todayDateOnly(),
    });
    if (invoiceNoParam) header.invoice_number = invoiceNoParam;
    if (invoiceDateParam) {
      const d = new Date(invoiceDateParam);
      header.invoice_date = Number.isNaN(d.getTime()) ? invoiceDateParam : d.toISOString().slice(0, 10);
    }
    return header;
  }, [invoiceDateParam, invoiceNoParam]);

  const pageTitle = inBillingFlow ? "Create Billing" : "Create Invoice";
  const pageDescription = inBillingFlow
    ? "Fill the fields for the selected billing template."
    : "Fill the fields. Values may vary every time.";
  const backLabel = inBillingFlow ? "Back to Billing" : "Back";
  const backTarget = inBillingFlow
    ? (projectId ? `/${projectId}/billing` : "/projects")
    : (projectId ? `/${projectId}/invoices` : "/projects");
  const backToList = () => navigate(backTarget);

  const [hiraInitialValues, setHiraInitialValues] = useState(() => ({ header: initialHeader, items: [{}] }));
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolvedProjectNumericId, setResolvedProjectNumericId] = useState(null);
  const [hiraFormKey, setHiraFormKey] = useState(0);
  const [lodhaInitialHeader, setLodhaInitialHeader] = useState(() => initialHeader);
  const [lodhaInitialData, setLodhaInitialData] = useState(() => null);
  const [lodhaFormKey, setLodhaFormKey] = useState(0);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const resolved = await resolveProjectNumericId(projectId);
        if (!active) return;
        setResolvedProjectNumericId(resolved);
      } catch {
        if (!active) return;
        setResolvedProjectNumericId(null);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (normalizedTemplate !== "hiranandani") return;
    if (!invoiceIdParam) {
      const header = withCommonCompanyHeader(initialHeader || {});
      setLodhaInitialHeader(header);
      setLodhaInitialData({ header, totals: {}, bankDeclaration: {}, items: [{}] });
      setLodhaFormKey((v) => v + 1);
      return;
    }
    let active = true;
    const run = async () => {
      setLoadingInvoice(true);
      try {
        const res = await api.getHiranandaniInvoice(invoiceIdParam);
        if (!res?.success) throw new Error(res?.error || "Failed to load invoice");
        const data = res.data?.data ?? res.data;
        const formData = hiranandaniApiToFormData(data);
        formData.header = withCommonCompanyHeader(formData.header);
        if (!active) return;
        setLodhaInitialHeader(formData?.header || {});
        setLodhaInitialData({
          header: formData?.header || {},
          totals: formData?.totals || {},
          bankDeclaration: formData?.bankDeclaration || {},
          items: Array.isArray(formData?.items) && formData.items.length ? formData.items : [{}],
        });
        setLodhaFormKey((v) => v + 1);
      } catch (e) {
        toast({
          title: "Failed to load invoice",
          description: e?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (active) setLoadingInvoice(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [initialHeader, invoiceIdParam, normalizedTemplate, toast]);

  const handleSave = async (data, options) => {
    if (!projectId) {
      toast({ title: "Missing project", description: "Open a project first.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const isLodha = normalizedTemplate === "lodha";
      const isHira = normalizedTemplate === "hiranandani";
      if (!isLodha && !isHira) throw new Error("Unsupported template");

      if (isLodha) {
        const header = data?.header || {};
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!String(header.invoice_number || "").trim()) throw new Error("Invoice number is required.");
        if (!String(header.invoice_date || "").trim()) throw new Error("Invoice date is required.");
        const hasAnyItem = items.some((row) => String(row?.description || "").trim());
        if (!hasAnyItem) throw new Error("Please add at least one item with a description.");
      }
      if (isHira) {
        const header = data?.header || {};
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!String(header.invoice_number || "").trim()) throw new Error("Invoice number is required.");
        if (!String(header.invoice_date || "").trim()) throw new Error("Invoice date is required.");
        if (!String(header.supplier_gstin || "").trim()) throw new Error("Supplier GSTIN is required.");
        const hasAnyItem = items.some((row) => String(row?.description || "").trim());
        if (!hasAnyItem) throw new Error("Please add at least one item with a description.");
      }

      const effectiveProjectId = resolvedProjectNumericId ?? (await resolveProjectNumericId(projectId));
      if (!effectiveProjectId) throw new Error("Could not resolve project id. Please re-open the project.");

      const payload = isLodha
        ? lodhaFormToApiPayload(data, effectiveProjectId)
        : hiranandaniFormToApiPayload(data, effectiveProjectId);
      const res = isLodha
        ? invoiceIdParam
          ? await api.updateLodhaInvoice(invoiceIdParam, payload)
          : await api.createLodhaInvoice(payload)
        : invoiceIdParam
          ? await api.updateHiranandaniInvoice(invoiceIdParam, payload)
          : await api.createHiranandaniInvoice(payload);

      if (!res?.success) throw new Error(res?.error || "Save failed");
      toast({ title: invoiceIdParam ? "Updated" : "Created", description: "Invoice saved successfully." });
      if (options?.closeAfter) backToList();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (normalizedTemplate !== "lodha") return;
    if (!invoiceIdParam) {
      setHiraInitialValues((prev) => ({
        ...(prev || {}),
        header: withCommonCompanyHeader({ ...(prev?.header || {}), ...(initialHeader || {}) }),
        projectWork: {
          work_order_date: todayDateOnly(),
          service_date_from: todayDateOnly(),
          service_date_to: todayDateOnly(),
          ...(prev?.projectWork || {}),
        },
      }));
      setHiraFormKey((v) => v + 1);
      return;
    }
    let active = true;
    const run = async () => {
      setLoadingInvoice(true);
      try {
        const res = await api.getLodhaInvoice(invoiceIdParam);
        if (!res?.success) throw new Error(res?.error || "Failed to load invoice");
        const data = res.data?.data ?? res.data;
        const formData = lodhaApiToFormData(data);
        formData.header = withCommonCompanyHeader(formData.header);
        if (!active) return;
        setHiraInitialValues(formData);
        setHiraFormKey((v) => v + 1);
      } catch (e) {
        toast({
          title: "Failed to load invoice",
          description: e?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (active) setLoadingInvoice(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [initialHeader, invoiceIdParam, normalizedTemplate, toast]);

  if (normalizedTemplate !== "lodha" && normalizedTemplate !== "hiranandani") {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-gradient-to-r from-cyan-50 via-sky-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Template: {templateLabel}</p>
            </div>
            <Button variant="outline" onClick={backToList} className="w-full lg:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" /> {backLabel}
            </Button>
          </div>
        </section>

        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <CardTitle className="text-lg">Template not ready</CardTitle>
            <CardDescription>Please pick either Lodha or Hira template.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{templateLabel}</Badge>
              <span className="text-sm text-muted-foreground">will be added next.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-cyan-50 via-sky-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
            <div className="mt-3">
              <Badge variant="secondary">Template: {templateLabel}</Badge>
            </div>
          </div>
          <Button variant="outline" onClick={backToList} className="w-full lg:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> {backLabel}
          </Button>
        </div>
      </section>

      {loadingInvoice ? (
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <CardTitle className="text-lg">Loading invoice…</CardTitle>
            <CardDescription>Fetching saved invoice details.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 text-sm text-muted-foreground">Please wait.</CardContent>
        </Card>
      ) : normalizedTemplate === "lodha" ? (
        <HiranandaniInvoiceForm
          key={`lodha-${invoiceIdParam || "new"}-${hiraFormKey}`}
          onSave={(data, options) => (saving ? null : handleSave(data, options))}
          initialValues={hiraInitialValues}
          autoDownload={autoDownload}
        />
      ) : (
        <LodhaInvoiceForm
          key={`hira-${invoiceIdParam || "new"}-${lodhaFormKey}`}
          onSave={(data, options) => (saving ? null : handleSave(data, options))}
          initialHeader={lodhaInitialHeader}
          autoDownload={autoDownload}
          initialData={lodhaInitialData}
        />
      )}

      {saving ? (
        <div className="text-sm text-muted-foreground">Saving…</div>
      ) : null}
    </div>
  );
}
