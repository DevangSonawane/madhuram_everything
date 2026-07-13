import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Eye, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatNumberIN } from '@/lib/numberFormat';
import QuoteLineItemsExcel from "@/components/quotes/QuoteLineItemsExcel";
import { RowActionsMenu } from "@/components/RowActionsMenu";

const toNumber = (value) => {
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export default function QuotesList({ inLayout = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [statusById, setStatusById] = useState({});
  const [fieldDefinitions, setFieldDefinitions] = useState([]);

  const statusOptions = [
    { label: "Draft", value: "draft" },
    { label: "Pending", value: "pending" },
    { label: "Sent", value: "sent" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];
  const normalizeStatus = (value) => String(value || "").trim().toLowerCase();
  const pickQuoteId = (quote) => {
    const candidates = [quote?.id, quote?.quotation_id, quote?.quotationId];
    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
    return null;
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
    const fetchQuotes = async () => {
      setLoading(true);
      const result = await api.getQuotations();
      if (!active) return;
      if (result.success) {
        const list = Array.isArray(result.data) ? result.data : result.data?.data || [];
        setQuotes(Array.isArray(list) ? list : []);
      } else {
        toast({
          title: 'Failed to load quotations',
          description: result.error || 'Unable to fetch quotations.',
          variant: 'destructive',
        });
      }
      setLoading(false);
    };
    fetchQuotes();
    return () => {
      active = false;
    };
  }, [location.state, toast]);

  const rows = useMemo(() => {
    return quotes.map((quote, idx) => {
      const items = Array.isArray(quote.items) ? quote.items : [];
      const totalFromItems = items.reduce((sum, item) => {
        const value = item?.amount ?? item?.final_rate_after_discount ?? item?.total_rate ?? 0;
        return sum + toNumber(value);
      }, 0);
      const totalAmount =
        totalFromItems ||
        toNumber(quote?.total_amount ?? quote?.totalAmount ?? quote?.total ?? 0);
      return {
        rowKey: pickQuoteId(quote) ?? `${quote.quotation_no || "quote"}-${idx}`,
        quoteId: pickQuoteId(quote),
        quotation_no: quote.quotation_no || `Quote-${idx + 1}`,
        project_name: quote.project_name || '-',
        client_name: quote.client_name || '-',
        quotation_date: quote.quotation_date || '-',
        total_amount: totalAmount,
        items,
        raw: quote,
      };
    });
  }, [quotes]);

  const handleStatusSelect = async (quote, nextValue) => {
    const id = pickQuoteId(quote);
    if (!id) {
      toast({ title: 'Missing quotation id', variant: 'destructive' });
      return;
    }

    const allowed = statusOptions.map((o) => o.value);
    const nextStatus = normalizeStatus(nextValue);
    if (!nextStatus || !allowed.includes(nextStatus)) {
      toast({
        title: 'Status required',
        description: 'Select a valid status (draft, pending, sent, approved, rejected).',
        variant: 'destructive',
      });
      return;
    }

    const prevStatusRaw = statusById[id] ?? quote?.status ?? quote?.quotation_status ?? "";
    const prevStatus = normalizeStatus(prevStatusRaw);
    if (prevStatus && prevStatus === nextStatus) return;

    setStatusById((prev) => ({ ...prev, [id]: nextStatus }));
    setUpdatingStatusId(id);
    const result = await api.updateQuotationStatus(id, { status: nextStatus });
    setUpdatingStatusId(null);

    if (result.success) {
      setQuotes((prev) =>
        prev.map((q) => {
          const qid = pickQuoteId(q);
          if (qid !== id) return q;
          return { ...q, status: nextStatus };
        })
      );
      toast({ title: 'Status updated', description: `Quotation marked as ${nextStatus}.` });
      return;
    }

    setStatusById((prev) => ({ ...prev, [id]: prevStatusRaw }));
    toast({
      title: 'Update failed',
      description: result.error || 'Unable to update status.',
      variant: 'destructive',
    });
  };

  const isStandalone = !inLayout && location.pathname.startsWith("/projects/quotes");
  const containerClass = isStandalone
    ? "w-full max-w-none px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8 space-y-6"
    : "space-y-6";

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

  return (
    <div className={containerClass}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground mt-2">Review created quotations and preview details.</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <Button variant="ghost" onClick={() => navigate('/projects/quotes/add')} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Create Quote
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quotations</CardTitle>
          <CardDescription>Review created quotations and preview details.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation No</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Last Date Revised Offer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Loading quotations...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No quotations yet. Create one to see it here.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.rowKey}>
                    <TableCell>{row.quotation_no}</TableCell>
                    <TableCell>{row.project_name}</TableCell>
                    <TableCell>{row.client_name}</TableCell>
                    <TableCell>{formatOfferDate(row.last_date_revised_offer || row.quotation_date)}</TableCell>
                    <TableCell>
                      {(() => {
                        const quote = row.raw || {};
                        const quoteId = row.quoteId;
                        const currentStatusRaw = (quoteId ? statusById[quoteId] : undefined) ?? quote.status ?? quote.quotation_status ?? "";
                        const currentStatus = normalizeStatus(currentStatusRaw);
                        const options = statusOptions.map((o) => o.value).includes(currentStatus) || !currentStatusRaw
                          ? statusOptions
                          : [{ label: String(currentStatusRaw), value: String(currentStatusRaw) }, ...statusOptions];
                        return (
                          <select
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                            value={currentStatusRaw}
                            disabled={Boolean(quoteId) && updatingStatusId === quoteId}
                            onChange={(event) => {
                              if (!quoteId) {
                                toast({ title: 'Missing quotation id', variant: 'destructive' });
                                return;
                              }
                              handleStatusSelect(quote, event.target.value);
                            }}
                          >
                            <option value="">Select</option>
                            {options.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumberIN(row.total_amount, { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <RowActionsMenu
                          items={[
                            {
                              key: "preview",
                              label: "Preview",
                              icon: Eye,
                              onSelect: () => setPreview(row),
                            },
                            {
                              key: "edit",
                              label: "Edit",
                              icon: Pencil,
                              disabled: !row.quoteId,
                              onSelect: () => {
                                if (!row.quoteId) {
                                  toast({ title: 'Missing quotation id', variant: 'destructive' });
                                  return;
                                }
                                navigate(`/projects/quotes/${row.quoteId}/edit`);
                              },
                            },
                          ]}
                          triggerLabel="Open quote actions"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(preview)} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Quotation Preview</DialogTitle>
          </DialogHeader>
          {preview && (() => {
            const boqRaw = normalizeList(
              preview?.boq_files ?? preview?.boq_file ?? preview?.boqFiles ?? preview?.boqFile
            );
            const boqUrlRaw = normalizeList(
              preview?.boq_file_urls ?? preview?.boq_files_urls ?? preview?.boq_file_url ?? preview?.boq_files_url ?? preview?.boq_urls ?? preview?.boq_links
            );
            const drawingRaw = normalizeList(
              preview?.drawing_files ?? preview?.drawing_file ?? preview?.drawingFiles ?? preview?.drawingFile
            );
            const drawingUrlRaw = normalizeList(
              preview?.drawing_file_urls ?? preview?.drawing_files_urls ?? preview?.drawing_file_url ?? preview?.drawing_files_url ?? preview?.drawing_urls ?? preview?.drawing_links
            );
            const boqSplit = splitFilesAndUrls([...boqRaw, ...boqUrlRaw]);
            const drawingSplit = splitFilesAndUrls([...drawingRaw, ...drawingUrlRaw]);
            const boqFiles = boqSplit.files.length ? boqSplit.files : [];
            const boqUrls = boqSplit.urls.length ? boqSplit.urls : [];
            const drawingFiles = drawingSplit.files.length ? drawingSplit.files : [];
            const drawingUrls = drawingSplit.urls.length ? drawingSplit.urls : [];
            const quotationDate = formatOfferDate(preview?.quotation_date);
            const revisedOfferDate = formatOfferDate(preview?.last_date_revised_offer || preview?.quotation_date);
            const gstPercentage = preview?.gst_percentage ?? preview?.gstPercentage;
            const gstDisplay = gstPercentage == null || gstPercentage === "" ? "-" : String(gstPercentage);
            const isRevisedOffer =
              typeof preview?.is_revised_offer === "boolean"
                ? preview.is_revised_offer
                  ? "Yes"
                  : "No"
                : preview?.is_revised_offer != null
                ? String(preview.is_revised_offer)
                : "-";
            const notes = preview?.notes || "-";
            const createdBy = preview?.created_by || "-";
            const createdByName = preview?.created_by_name || "-";
            const items = (Array.isArray(preview?.items) ? preview.items : []).map((row) => flattenDynamicValues(row));
            const fieldList = Array.isArray(fieldDefinitions) ? fieldDefinitions : [];
            const orderedFieldKeys = fieldList.length
              ? [...fieldList]
                  .slice()
                  .sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0))
                  .map((f) => String(f.field_key))
                  .filter(Boolean)
              : [];
            const itemColumns = (() => {
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
              return orderedFieldKeys.length ? [...orderedFieldKeys, ...extras] : extras;
            })();
            const columnLabels = fieldList.reduce((acc, f) => {
              if (f?.field_key && f?.label) acc[String(f.field_key)] = String(f.label);
              return acc;
            }, {});

            return (
            <div className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div><strong>Project Name:</strong> {preview.project_name || '-'}</div>
                <div><strong>Client Name:</strong> {preview.client_name || '-'}</div>
                <div><strong>Quotation No:</strong> {preview.quotation_no || '-'}</div>
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
              <QuoteLineItemsExcel
                mode="view"
                items={items}
                columns={itemColumns}
                columnLabels={columnLabels}
                className="border border-border"
              />
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
