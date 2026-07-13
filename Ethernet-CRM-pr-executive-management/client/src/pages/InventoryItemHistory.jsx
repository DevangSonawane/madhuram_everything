import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const changeTypeBadge = (type) => {
  const map = {
    stock_in: { label: "Stock In", className: "bg-green-100 text-green-800 border-green-300" },
    stock_out: { label: "Stock Out", className: "bg-red-100 text-red-800 border-red-300" },
    adjustment: { label: "Adjustment", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    created: { label: "Created", className: "bg-blue-100 text-blue-800 border-blue-300" },
    updated: { label: "Updated", className: "bg-gray-100 text-gray-800 border-gray-300" },
    deleted: { label: "Deleted", className: "bg-red-50 text-red-700 border-red-200" },
  };
  const entry = map[type] || { label: type || "-", className: "" };
  return (
    <Badge variant="outline" className={entry.className}>
      {entry.label}
    </Badge>
  );
};

export default function InventoryItemHistory({ inLayout = false }) {
  const { inventoryId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [item, setItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, current_page: 1, has_next: false, has_prev: false });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", change_type: "" });
  const [page, setPage] = useState(1);
  const dateTimerRef = useRef(null);

  const fetchHistory = useCallback(async () => {
    if (!inventoryId) return;
    setLoading(true);
    try {
      const res = await api.getInventoryHistoryByItem(inventoryId, {
        ...filters,
        page,
        limit: 50,
        sort: "desc",
      });
      if (!res.success) {
        toast({ title: "Error", description: res.error || "Failed to load item history.", variant: "destructive" });
        setHistory([]);
        return;
      }
      const payload = res.data || {};
      setItem(payload.item || null);
      setSummary(payload.summary || null);
      const rowsRaw = Array.isArray(payload.history) ? payload.history : [];
      const rows = Array.from(
        new Map(
          rowsRaw.map((row, idx) => {
            const keyParts = [
              row.inventory_id,
              row.change_type,
              row.stock_in,
              row.stock_out,
              row.balance_before,
              row.balance_after,
              row.source_type,
              row.source_ref,
              row.performed_by,
              row.created_at,
            ];
            const compositeKey = keyParts.join("|");
            const key = compositeKey !== "|||||||||" ? compositeKey : (row.history_id ?? idx);
            return [key, row];
          })
        ).values()
      );
      setHistory(rows);
      setPagination(payload.pagination || { total: rows.length, total_pages: 1, current_page: page, has_next: false, has_prev: page > 1 });
    } finally {
      setLoading(false);
    }
  }, [filters, inventoryId, page, toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const updateFilter = (key, value, debounce = false) => {
    if (debounce) {
      clearTimeout(dateTimerRef.current);
      dateTimerRef.current = setTimeout(() => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
      }, 400);
      return;
    }
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({ from: "", to: "", change_type: "" });
    setPage(1);
  };

  const pageLabel = useMemo(() => {
    const totalPages = pagination.total_pages || 1;
    const apiTotal = pagination.total ?? history.length;
    const totalRecords = history.length > 0 && history.length < apiTotal ? history.length : apiTotal;
    return `Page ${pagination.current_page || page} of ${totalPages} | Total ${totalRecords} records`;
  }, [pagination, history.length, page]);

  return (
    <div
      className={
        inLayout
          ? "space-y-6"
          : "content-shell px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8 space-y-6"
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Item History</h1>
          <p className="text-muted-foreground mt-2">Full movement log for this item.</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Item Details</CardTitle>
            <CardDescription>Basic inventory information.</CardDescription>
          </CardHeader>
          <CardContent>
            {!item ? (
              <div className="text-sm text-muted-foreground">Loading item details...</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">Inventory ID:</span> {item.inventory_id ?? "-"}</div>
                <div><span className="text-muted-foreground">Name:</span> {item.name ?? "-"}</div>
                <div><span className="text-muted-foreground">Brand:</span> {item.brand ?? "-"}</div>
                <div><span className="text-muted-foreground">Unit:</span> {item.units ?? "-"}</div>
                <div><span className="text-muted-foreground">Price:</span> ₹{Number(item.price || 0).toLocaleString("en-IN")}</div>
                <div><span className="text-muted-foreground">Current Qty:</span> {item.current_quantity ?? item.quantity ?? "-"}</div>
                <div><span className="text-muted-foreground">Stock Status:</span> {item.stockin ? "In" : "Out"}</div>
                <div><span className="text-muted-foreground">Billing:</span> {item.billing ? "Billing" : "Non Billings"}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Aggregate movement stats.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Events</span>
              <span>{summary?.total_events ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stock In</span>
              <span>{summary?.total_stock_in ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stock Out</span>
              <span>{summary?.total_stock_out ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unique Users</span>
              <span>{summary?.unique_users ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">First Event</span>
              <span>{formatDateTime(summary?.first_event_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Event</span>
              <span>{formatDateTime(summary?.last_event_at)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value, true)} />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={filters.to} onChange={(e) => updateFilter("to", e.target.value, true)} />
          </div>
          <Select value={filters.change_type || "all"} onValueChange={(value) => updateFilter("change_type", value === "all" ? "" : value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Change Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="stock_in">Stock In</SelectItem>
              <SelectItem value="stock_out">Stock Out</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={resetFilters}>Reset</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>History Log</CardTitle>
            <CardDescription>{pageLabel}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!pagination.has_prev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!pagination.has_next} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead className="text-right">Out</TableHead>
                <TableHead className="text-right">Before</TableHead>
                <TableHead className="text-right">After</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Loading history...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No history records found.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((row) => (
                  <TableRow key={row.history_id || `${row.inventory_id}-${row.created_at}`}>
                    <TableCell className="text-xs">{formatDateTime(row.created_at)}</TableCell>
                    <TableCell>{changeTypeBadge(row.change_type)}</TableCell>
                    <TableCell className="text-right">{row.stock_in ?? "-"}</TableCell>
                    <TableCell className="text-right">{row.stock_out ?? "-"}</TableCell>
                    <TableCell className="text-right">{row.balance_before ?? "-"}</TableCell>
                    <TableCell className="text-right">{row.balance_after ?? "-"}</TableCell>
                    <TableCell className="text-xs">{row.source_ref || row.source_type_label || row.source_type || "-"}</TableCell>
                    <TableCell className="text-xs">{row.performed_by_name || row.performed_by || "-"}</TableCell>
                    <TableCell className="text-xs">{row.notes || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
