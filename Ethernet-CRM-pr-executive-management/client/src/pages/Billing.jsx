import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { formatCurrencyINR } from "@/lib/numberFormat";
import { lodhaApiToFormData } from "@/lib/invoiceTransforms";
import { downloadInvoiceExcel } from "@/pages/createExcelInvoice";
import { downloadInvoicePdf } from "@/pages/createHtmlInvoice";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/useProject";
import { ChevronDown, Eye, FileSpreadsheet, FileText, Loader2, Plus, Trash2 } from "lucide-react";

export default function Billing() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { selectedProject } = useProject();
  const { toast } = useToast();

  const effectiveProjectId = selectedProject?.id ?? selectedProject?.project_id ?? projectId ?? null;

  const [lodhaBills, setLodhaBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const toNumber = (value) => {
    if (value == null || value === "") return 0;
    const cleaned = String(value).replace(/,/g, "").trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };
  const toDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };
  const formatDate = (value) => {
    const d = toDate(value);
    if (!d) return "-";
    return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
  };

  const statusBadgeVariant = (status) => {
    if (status === "Approved") return "default";
    if (status === "Submitted") return "secondary";
    return "outline";
  };

  useEffect(() => {
    let active = true;
    const fetchBills = async () => {
      if (!effectiveProjectId) {
        setLodhaBills([]);
        return;
      }
      setLoading(true);
      try {
        const res = await api.getLodhaInvoicesByProject(effectiveProjectId);
        const list = res?.success && Array.isArray(res.data) ? res.data : [];
        const normalized = list
          .map((row) => {
            const id = row?.id ?? row?.lodha_invoice_id ?? row?.invoice_id ?? row?._id ?? row?.invoiceId;
            const invoice = row?.invoice ?? row?.data?.invoice ?? row;
            const totals = invoice?.totals ?? row?.totals ?? {};

            const statusRaw = row?.status ?? invoice?.status ?? row?.invoice_status ?? row?.invoiceStatus ?? "Draft";
            const status = /approved/i.test(String(statusRaw))
              ? "Approved"
              : /submitted/i.test(String(statusRaw))
                ? "Submitted"
                : "Draft";

            return {
              id,
              ra_bill_no: invoice?.workOrderDetails?.billNo ?? row?.ra_bill_no ?? row?.ra_number ?? row?.bill_no ?? "",
              invoice_no: invoice?.invoiceNo ?? row?.invoice_no ?? row?.invoice_number ?? "",
              invoice_date: invoice?.invoiceDate ?? row?.invoice_date ?? "",
              work_order_no: invoice?.workOrderDetails?.woNo ?? row?.work_order_number ?? row?.wo_no ?? "",
              taxable_amount: toNumber(totals?.totalTaxableValue ?? row?.taxable_amount ?? row?.taxableValue ?? 0),
              total_with_gst: toNumber(totals?.totalInvoiceValueFigure ?? row?.total_invoice_value ?? row?.total_with_gst ?? 0),
              status,
            };
          })
          .filter((row) => row.id != null)
          .sort((a, b) => (toDate(b.invoice_date)?.getTime() || 0) - (toDate(a.invoice_date)?.getTime() || 0));

        if (!active) return;
        setLodhaBills(normalized);
      } catch (e) {
        if (!active) return;
        toast({ title: "Failed to load billing", description: String(e?.message || e), variant: "destructive" });
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchBills();
    return () => {
      active = false;
    };
  }, [effectiveProjectId, toast]);

  const handleDownloadExcel = useCallback(async (billId) => {
    try {
      const res = await api.getLodhaInvoice(billId);
      if (!res?.success) throw new Error(res?.error || "Failed to fetch invoice");
      const legacy = lodhaApiToFormData(res?.data ?? res);
      await downloadInvoiceExcel("lodha", legacy);
    } catch (e) {
      toast({ title: "Excel download failed", description: String(e?.message || e), variant: "destructive" });
    }
  }, [toast]);

  const handleDownloadPdf = useCallback(async (billId) => {
    try {
      const res = await api.getLodhaInvoice(billId);
      if (!res?.success) throw new Error(res?.error || "Failed to fetch invoice");
      const legacy = lodhaApiToFormData(res?.data ?? res);
      await downloadInvoicePdf("lodha", legacy);
    } catch (e) {
      toast({ title: "PDF download failed", description: String(e?.message || e), variant: "destructive" });
    }
  }, [toast]);

  const handleDelete = useCallback(async (billId) => {
    const ok = window.confirm("Delete this RA bill? This cannot be undone.");
    if (!ok) return;
    try {
      const res = await api.deleteLodhaInvoice(billId);
      if (!res?.success) throw new Error(res?.error || "Failed to delete");
      setLodhaBills((prev) => prev.filter((b) => String(b.id) !== String(billId)));
      toast({ title: "Deleted", description: "RA bill deleted successfully." });
    } catch (e) {
      toast({ title: "Delete failed", description: String(e?.message || e), variant: "destructive" });
    }
  }, [toast]);

  const openLuckySheetView = useCallback((billId) => {
    navigate(`/${projectId}/billing/invoice-editor?billId=${encodeURIComponent(String(billId))}`);
  }, [navigate, projectId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground mt-2">Create and manage Running Account (RA) bills for the selected project.</p>
        </div>

        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" disabled={!projectId}>
              <Plus className="mr-2 h-4 w-4" /> Create New Billing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Select Billing Template</DialogTitle>
              <DialogDescription>Choose the client format for this billing entry.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-xl">LODHA</CardTitle>
                  <CardDescription>Lodha/Macrotech RA Bill format with Checklist, Cumm BOQ, Challan Summary, MIR Summary, ITR Summary, Illegal Immigration, and Amend.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-[140px] flex-col justify-between gap-6">
                  <div className="text-sm text-muted-foreground">Template available</div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setTemplateDialogOpen(false);
                      navigate(`/${projectId}/billing/invoice-editor?template=lodha`);
                    }}
                  >
                    Select Lodha
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-xl">HIRANANDANI</CardTitle>
                  <CardDescription>Hiranandani billing format using the existing Hiranandani creation flow.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-[140px] flex-col justify-between gap-6">
                  <div className="text-sm text-muted-foreground">Template available</div>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      setTemplateDialogOpen(false);
                      navigate(`/${projectId}/billing/invoice-editor?template=hiranandani`);
                    }}
                  >
                    Select Hiranandani
                  </Button>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RA Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">RA Bill No</TableHead>
                  <TableHead className="text-center">Invoice No</TableHead>
                  <TableHead className="text-center">Invoice Date</TableHead>
                  <TableHead className="text-center">Work Order No</TableHead>
                  <TableHead className="text-center">Taxable Amount</TableHead>
                  <TableHead className="text-center">Total (with GST)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading RA bills...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : lodhaBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {effectiveProjectId ? "No RA bills created yet." : "Select a project to view billing."}
                    </TableCell>
                  </TableRow>
                ) : (
                  lodhaBills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium text-center">{bill.ra_bill_no || "-"}</TableCell>
                      <TableCell className="text-center">{bill.invoice_no || "-"}</TableCell>
                      <TableCell className="text-center">{formatDate(bill.invoice_date)}</TableCell>
                      <TableCell className="text-center">{bill.work_order_no || "-"}</TableCell>
                      <TableCell className="text-center font-medium">{formatCurrencyINR(bill.taxable_amount || 0)}</TableCell>
                      <TableCell className="text-center font-bold">{formatCurrencyINR(bill.total_with_gst || 0)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={statusBadgeVariant(bill.status)}>{bill.status}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Eye className="mr-2 h-4 w-4" /> View <ChevronDown className="ml-2 h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openLuckySheetView(bill.id)}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> Lucky Sheet View
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="secondary" size="sm">
                                Download <ChevronDown className="ml-2 h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDownloadExcel(bill.id)}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadPdf(bill.id)}>
                                <FileText className="mr-2 h-4 w-4" /> Download PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <Button variant="destructive" size="sm" onClick={() => handleDelete(bill.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-4">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading RA bills...</p>
              </div>
            ) : lodhaBills.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>{effectiveProjectId ? "No RA bills created yet." : "Select a project to view billing."}</p>
              </div>
            ) : (
              lodhaBills.map((bill) => (
                <Card key={bill.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{bill.ra_bill_no || "RA Bill"}</div>
                      <div className="text-sm text-muted-foreground">{bill.invoice_no || "-"}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(bill.invoice_date)}</div>
                    </div>
                    <Badge variant={statusBadgeVariant(bill.status)}>{bill.status}</Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div><span className="text-muted-foreground">WO No:</span> {bill.work_order_no || "-"}</div>
                    <div><span className="text-muted-foreground">Taxable:</span> {formatCurrencyINR(bill.taxable_amount || 0)}</div>
                    <div className="font-semibold"><span className="text-muted-foreground">Total:</span> {formatCurrencyINR(bill.total_with_gst || 0)}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" /> View <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => openLuckySheetView(bill.id)}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" /> Lucky Sheet View
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="secondary" size="sm" onClick={() => handleDownloadExcel(bill.id)}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleDownloadPdf(bill.id)}>
                      <FileText className="mr-2 h-4 w-4" /> PDF
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(bill.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
