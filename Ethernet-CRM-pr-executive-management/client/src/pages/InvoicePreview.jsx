import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Eye, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { withCommonCompanyHeader } from "@/lib/companyDefaults";
import { downloadInvoicePdf } from "./createHtmlInvoice";
import { hiranandaniApiToFormData, lodhaApiToFormData } from "@/lib/invoiceTransforms";

export default function InvoicePreview() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const invoiceId = useMemo(() => String(searchParams.get("id") || "").trim(), [searchParams]);
  const template = useMemo(() => String(searchParams.get("template") || "").trim(), [searchParams]);
  const normalizedTemplate = useMemo(() => template.toLowerCase(), [template]);

  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState(null);

  const backToInvoices = () => navigate(projectId ? `/${projectId}/invoices` : "/projects");

  useEffect(() => {
    if (!invoiceId) return;
    const t = normalizedTemplate || "hiranandani";
    if (t !== "hiranandani" && t !== "lodha") return;
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = t === "lodha" ? await api.getLodhaInvoice(invoiceId) : await api.getHiranandaniInvoice(invoiceId);
        if (!res?.success) throw new Error(res?.error || "Failed to load invoice");
        const data = res.data?.data ?? res.data;
        if (!active) return;
        setInvoice(data);
      } catch (e) {
        if (!active) return;
        setInvoice(null);
        toast({
          title: "Failed to load invoice",
          description: e?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [invoiceId, normalizedTemplate, toast]);

  const downloadPdf = () => {
    if (!invoice) return;
    const t = normalizedTemplate || "hiranandani";
    const formData = t === "lodha" ? lodhaApiToFormData(invoice) : hiranandaniApiToFormData(invoice);
    downloadInvoicePdf(t === "lodha" ? "lodha" : "hiranandani", formData);
  };

  const formData = useMemo(() => {
    if (!invoice) return null;
    const t = normalizedTemplate || "hiranandani";
    const raw = t === "lodha" ? lodhaApiToFormData(invoice) : hiranandaniApiToFormData(invoice);
    return {
      ...(raw || {}),
      header: withCommonCompanyHeader(raw?.header || {}),
    };
  }, [invoice, normalizedTemplate]);

  const header = formData?.header || {};

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-cyan-50 via-sky-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-2">
              <Eye className="h-6 w-6" /> Invoice Preview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Preview invoice details.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {invoiceId ? <Badge variant="secondary">ID: {invoiceId}</Badge> : null}
              <Badge variant="secondary">Template: {(normalizedTemplate || "hiranandani") === "lodha" ? "Lodha" : "Hiranandani"}</Badge>
            </div>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto">
            <Button variant="outline" onClick={backToInvoices} className="w-full lg:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button
              onClick={downloadPdf}
              disabled={!invoice}
              className="w-full lg:w-auto"
            >
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="pb-4 border-b bg-muted/20">
          <CardTitle className="text-lg">Preview</CardTitle>
          <CardDescription>{loading ? "Loading invoice..." : "Invoice details"}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : !invoice ? (
            <div className="text-sm text-muted-foreground">No invoice loaded.</div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Invoice No</div>
                  <div className="font-medium">{header.invoice_number || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Invoice Date</div>
                  <div className="font-medium">{header.invoice_date || "-"}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground">Company</div>
                  <div className="font-medium">{header.company_name || "-"}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground">Building / Work</div>
                  <div className="font-medium">{header.building_name || header.work_description || "-"}</div>
                </div>
              </div>

              {Array.isArray(formData?.items) && formData.items.length ? (
                <div>
                  <div className="text-muted-foreground mb-2">Items</div>
                  <div className="space-y-1">
                    {formData.items.map((it, idx) => (
                      <div key={`inv-item-${idx}`} className="rounded-md border border-border p-2">
                        <div className="font-medium">
                          {it.goods_or_service_description || it.description || `Item ${idx + 1}`}
                        </div>
                        <div className="text-muted-foreground">
                          SAC: {it.sac_code || "-"} • Value: {it.value_of_supply ?? "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
