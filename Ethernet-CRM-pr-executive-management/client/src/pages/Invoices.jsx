import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, Loader2, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { isNumericId, resolveProjectNumericId } from "@/lib/resolveProjectId";
import { hiranandaniApiToFormData, lodhaApiToFormData } from "@/lib/invoiceTransforms";
import { downloadInvoicePdf } from "./createHtmlInvoice";

export default function Invoices() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { toast } = useToast();

  const resolvedProjectId = useMemo(() => String(projectId || "").trim(), [projectId]);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [resolvedProjectNumericId, setResolvedProjectNumericId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const activeTemplate = "hiranandani";

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const normalizeList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === "object") {
      if (Array.isArray(payload.data)) return payload.data;
      if (Array.isArray(payload.rows)) return payload.rows;
      if (payload.data && typeof payload.data === "object") {
        if (Array.isArray(payload.data.data)) return payload.data.data;
        if (Array.isArray(payload.data.rows)) return payload.data.rows;
      }
    }
    return [];
  };

  const fetchInvoices = async () => {
    const effectiveProjectId = isNumericId(resolvedProjectId) ? resolvedProjectId : resolvedProjectNumericId;
    if (!effectiveProjectId) return;
    setLoading(true);
    try {
      const [hiraRes, lodhaRes] = await Promise.all([
        api.getHiranandaniInvoicesByProject(effectiveProjectId),
        api.getLodhaInvoicesByProject(effectiveProjectId),
      ]);

      if (!hiraRes?.success) throw new Error(hiraRes?.error || "Failed to load Hiranandani invoices");
      if (!lodhaRes?.success) throw new Error(lodhaRes?.error || "Failed to load Lodha invoices");

      const hiraRows = normalizeList(hiraRes.data);
      const lodhaRows = normalizeList(lodhaRes.data);

      const normalizedHira = hiraRows.map((inv) => ({
        id: inv?.id ?? inv?.invoice_id ?? inv?._id,
        invoice_no: inv?.invoice_number ?? inv?.invoice_no ?? inv?.invoiceNo ?? "",
        project_id: inv?.project_id ?? inv?.projectId ?? inv?.project?.id ?? "",
        invoice_date: inv?.invoice_date ?? inv?.invoiceDate ?? inv?.created_at ?? inv?.createdAt ?? "",
        status: inv?.status ?? inv?.invoice_status ?? "Draft",
        template: "hiranandani",
        raw: inv,
      }));

      const normalizedLodha = lodhaRows.map((inv) => ({
        id: inv?.id ?? inv?.invoice_id ?? inv?._id,
        invoice_no: inv?.invoice_number ?? inv?.invoice_no ?? inv?.invoiceNo ?? "",
        project_id: inv?.project_id ?? inv?.projectId ?? inv?.project?.id ?? "",
        invoice_date: inv?.invoice_date ?? inv?.invoiceDate ?? inv?.created_at ?? inv?.createdAt ?? "",
        status: inv?.status ?? inv?.invoice_status ?? "Draft",
        template: "lodha",
        raw: inv,
      }));

      const merged = [...normalizedHira, ...normalizedLodha]
        .filter((row) => row.id != null)
        .sort((a, b) => new Date(b.invoice_date || 0).getTime() - new Date(a.invoice_date || 0).getTime());

      setInvoices(merged);
    } catch (e) {
      setInvoices([]);
      toast({
        title: "Failed to load invoices",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If the route uses a non-numeric project key (e.g. name), wait until we
    // resolve it to a numeric id before hitting /project/:projectId endpoints.
    if (!resolvedProjectId) return;
    if (!isNumericId(resolvedProjectId) && !resolvedProjectNumericId) return;
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedProjectId, resolvedProjectNumericId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const resolved = await resolveProjectNumericId(resolvedProjectId);
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
  }, [resolvedProjectId]);

  const openCreateForTemplate = (template) => {
    const t = String(template || "").toLowerCase();
    navigate(resolvedProjectId ? `/${resolvedProjectId}/invoices/create?template=${encodeURIComponent(t)}` : "/projects");
  };

  const filteredInvoices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return invoices;
    return invoices.filter((row) => {
      const invNo = String(row.invoice_no || "").toLowerCase();
      const projectId = String(row.project_id || "").toLowerCase();
      const status = String(row.status || "").toLowerCase();
      return invNo.includes(normalized) || projectId.includes(normalized) || status.includes(normalized);
    });
  }, [invoices, query]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-cyan-50 via-sky-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create and manage project invoices.
            </p>
            <div className="mt-3">
              <Badge variant="secondary">Template: Hiranandani</Badge>
            </div>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto">
            <Button onClick={() => setIsTemplateDialogOpen(true)} className="w-full lg:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="pb-4 border-b bg-muted/20">
          <CardTitle className="text-lg">Invoice List</CardTitle>
          <CardDescription>All invoice entries for the selected scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Search by invoice no, project, status..."
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Invoice No</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    No invoice records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.invoice_no || row.id}</TableCell>
                      <TableCell>{row.project_id || "-"}</TableCell>
                      <TableCell>{formatDate(row.invoice_date)}</TableCell>
                      <TableCell>
                        <Badge variant={String(row.status).toLowerCase() === "submitted" ? "default" : "secondary"}>
                          {row.status || "Draft"}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" aria-label="Actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onSelect={() =>
                              navigate(
                                resolvedProjectId
                                  ? `/${resolvedProjectId}/invoices/preview?id=${encodeURIComponent(String(row.id || ""))}&template=${encodeURIComponent(String(row.template || ""))}`
                                  : "/projects",
                              )
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" /> Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              navigate(
                                resolvedProjectId
                                  ? `/${resolvedProjectId}/invoices/create?template=${encodeURIComponent(String(row.template || ""))}&id=${encodeURIComponent(String(row.id || ""))}`
                                  : "/projects",
                              )
                            }
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={async () => {
                              const id = row?.id;
                              if (!id) return;
                              try {
                                const template = String(row?.template || "").toLowerCase();
                                const res =
                                  template === "lodha" ? await api.getLodhaInvoice(id) : await api.getHiranandaniInvoice(id);
                                if (!res?.success) throw new Error(res?.error || "Failed to load invoice");
                                const invoice = res.data?.data ?? res.data;
                                const formData =
                                  template === "lodha" ? lodhaApiToFormData(invoice) : hiranandaniApiToFormData(invoice);
                                await downloadInvoicePdf(template === "lodha" ? "lodha" : "hiranandani", formData);
                              } catch (e) {
                                toast({
                                  title: "Download failed",
                                  description: e?.message || "Please try again.",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => {
                              setDeleteError("");
                              setDeleteTarget(row);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="sm:max-w-xl border-0 bg-background p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/60 px-6 py-5 sm:px-8">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">
              Create New Invoice
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              Choose the invoice template you want to create.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
            <button
              type="button"
              onClick={() => {
                setIsTemplateDialogOpen(false);
                openCreateForTemplate("lodha");
              }}
              className="w-full rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                Template
              </div>
              <div className="mt-4 text-xl font-semibold tracking-tight text-foreground">Lodha</div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">Lodha invoice format.</div>
              <div className="mt-5 inline-flex items-center text-sm font-medium text-primary">
                Continue with Lodha
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsTemplateDialogOpen(false);
                openCreateForTemplate("hiranandani");
              }}
              className="w-full rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                Template
              </div>
              <div className="mt-4 text-xl font-semibold tracking-tight text-foreground">Hiranandani</div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">Hiranandani invoice format.</div>
              <div className="mt-5 inline-flex items-center text-sm font-medium text-primary">
                Continue with Hiranandani
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setDeleteError("");
            setDeleting(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete invoice?</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
              {deleteTarget?.invoice_no ? ` Invoice: ${deleteTarget.invoice_no}` : ""}
            </DialogDescription>
          </DialogHeader>

          {deleteError ? <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{deleteError}</div> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting || !deleteTarget?.id}
              onClick={async () => {
                const id = deleteTarget?.id;
                if (!id) return;
                setDeleting(true);
                setDeleteError("");
                try {
                  const template = String(deleteTarget?.template || "").toLowerCase();
                  const res = template === "lodha" ? await api.deleteLodhaInvoice(id) : await api.deleteHiranandaniInvoice(id);
                  if (!res?.success) throw new Error(res?.error || "Could not delete invoice.");
                  setDeleteDialogOpen(false);
                  await fetchInvoices();
                } catch (e) {
                  setDeleteError(e?.message || "Delete failed. Please try again.");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
