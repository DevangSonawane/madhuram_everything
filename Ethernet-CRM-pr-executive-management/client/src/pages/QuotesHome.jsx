import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, ArrowLeft, Eye, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatNumberIN } from '@/lib/numberFormat';
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

export default function QuotesHome({ inLayout = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [quoteToDelete, setQuoteToDelete] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [statusById, setStatusById] = useState({});

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

  useEffect(() => {
    let active = true;
    const fetchQuotes = async () => {
      setQuotesLoading(true);
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
      setQuotesLoading(false);
    };
    fetchQuotes();
    return () => {
      active = false;
    };
  }, [toast]);

  const requestDeleteQuote = (quote) => {
    setQuoteToDelete(quote);
  };

  const handleDeleteQuote = async () => {
    const quote = quoteToDelete;
    const id = pickQuoteId(quote);
    if (!id) {
      toast({ title: 'Missing quotation id', variant: 'destructive' });
      return;
    }
    setDeletingId(id);
    const result = await api.deleteQuotation(id);
    setDeletingId(null);
    if (result.success) {
      setQuotes((prev) => prev.filter((q) => pickQuoteId(q) !== id));
      setQuoteToDelete(null);
      toast({ title: 'Deleted', description: 'Quotation deleted.' });
    } else {
      toast({
        title: 'Delete failed',
        description: result.error || 'Unable to delete quotation.',
        variant: 'destructive',
      });
    }
  };

  const handleStatusSelect = async (quote, nextValue) => {
    const id = pickQuoteId(quote);
    if (!id) {
      toast({ title: 'Missing quotation id', variant: 'destructive' });
      return;
    }
    const allowed = statusOptions.map((o) => o.value);
    const nextStatus = normalizeStatus(nextValue);
    if (!allowed.includes(nextStatus)) {
      toast({
        title: 'Status required',
        description: 'Select a valid status (draft, pending, sent, approved, rejected).',
        variant: 'destructive',
      });
      return;
    }
    if (!nextStatus) {
      toast({ title: 'Status required', description: 'Select a status first.', variant: 'destructive' });
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
    } else {
      setStatusById((prev) => ({ ...prev, [id]: prevStatusRaw }));
      toast({
        title: 'Update failed',
        description: result.error || 'Unable to update status.',
        variant: 'destructive',
      });
    }
  };

  const isStandalone = !inLayout && location.pathname.startsWith("/projects/quotes");
  const containerClass = isStandalone
    ? "content-shell px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8"
    : "space-y-6";

  const formatOfferDate = (value) => {
    if (!value) return "-";
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const text = String(value);
    if (text.includes("T")) return text.split("T")[0];
    return text.trim() || "-";
  };

  return (
    <div className={containerClass}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground mt-2">
            Review quotations and create new ones.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="ghost" onClick={() => navigate('/projects')} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
          </Button>
          <Button onClick={() => navigate('/projects/quotes/new')} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Create a Quote
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quotations</CardTitle>
          <CardDescription>All saved quotations.</CardDescription>
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
              {quotesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Loading quotations...
                  </TableCell>
                </TableRow>
              ) : quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No quotations yet.
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((quote, idx) => {
                  const items = Array.isArray(quote.items) ? quote.items : [];
                  const totalFromItems = items.reduce((sum, item) => {
                    const value = item?.amount ?? item?.final_rate_after_discount ?? item?.total_rate ?? 0;
                    return sum + toNumber(value);
                  }, 0);
                  const totalAmount =
                    totalFromItems ||
                    toNumber(quote?.total_amount ?? quote?.totalAmount ?? quote?.total ?? 0);
                  const quoteId = pickQuoteId(quote);
                  const rowKey = quoteId ?? `${quote?.quotation_no || 'quote'}-${idx}`;
                  const currentStatusRaw = (quoteId ? statusById[quoteId] : undefined) ?? quote.status ?? quote.quotation_status ?? "";
                  const currentStatus = normalizeStatus(currentStatusRaw);
                  const options = statusOptions.map((o) => o.value).includes(currentStatus) || !currentStatusRaw
                    ? statusOptions
                    : [{ label: String(currentStatusRaw), value: String(currentStatusRaw) }, ...statusOptions];
                  return (
                    <TableRow key={rowKey}>
                      <TableCell>{quote.quotation_no || `Quote-${idx + 1}`}</TableCell>
                      <TableCell>{quote.project_name || '-'}</TableCell>
                      <TableCell>{quote.client_name || '-'}</TableCell>
                      <TableCell>{formatOfferDate(quote.last_date_revised_offer || quote.quotation_date)}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumberIN(totalAmount, { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <RowActionsMenu
                            items={[
                              {
                                key: "preview",
                                label: "Preview",
                                icon: Eye,
                                disabled: !quoteId,
                                onSelect: () => {
                                  if (!quoteId) {
                                    toast({ title: 'Missing quotation id', variant: 'destructive' });
                                    return;
                                  }
                                  navigate(`/projects/quotes/${quoteId}`);
                                },
                              },
                              {
                                key: "edit",
                                label: "Edit",
                                icon: Pencil,
                                disabled: !quoteId,
                                onSelect: () => {
                                  if (!quoteId) {
                                    toast({ title: 'Missing quotation id', variant: 'destructive' });
                                    return;
                                  }
                                  navigate(`/projects/quotes/${quoteId}/edit`);
                                },
                              },
                              { type: "separator" },
                              {
                                key: "delete",
                                label: deletingId === quoteId ? "Deleting..." : "Delete",
                                icon: Trash2,
                                destructive: true,
                                disabled: !quoteId || deletingId === quoteId,
                                onSelect: () => requestDeleteQuote(quote),
                              },
                            ]}
                            triggerLabel="Open quote actions"
                            disabled={Boolean(deletingId === quoteId)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!quoteToDelete} onOpenChange={(open) => !open && setQuoteToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Quotation</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{quoteToDelete?.quotation_no || "this quotation"}</span>.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteToDelete(null)} disabled={deletingId === pickQuoteId(quoteToDelete)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteQuote} disabled={deletingId === pickQuoteId(quoteToDelete)}>
              {deletingId === pickQuoteId(quoteToDelete) ? "Deleting..." : "Delete Quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
