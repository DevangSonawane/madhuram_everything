import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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

export default function InventoryHistory({ inLayout = false }) {
  const { toast } = useToast();
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, current_page: 1, has_next: false, has_prev: false });
  const [loading, setLoading] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [projects, setProjects] = useState([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    change_type: "",
    source_type: "",
    project_id: "",
    inventory_id: "",
    user_id: "",
  });
  const dateTimerRef = useRef(null);

  const overall = summary?.overall || summary || {};

  const fetchProjects = useCallback(async () => {
    const res = await api.getProjects();
    if (res.success && Array.isArray(res.data)) {
      setProjects(res.data);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await api.getInventoryHistorySummary({ from: filters.from || undefined, to: filters.to || undefined });
      if (res.success) {
        setSummary(res.data || null);
      }
    } finally {
      setLoadingSummary(false);
    }
  }, [filters.from, filters.to]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getInventoryHistory({
        ...filters,
        page,
        limit: 20,
        sort: "desc",
      });
      if (!res.success) {
        toast({ title: "Error", description: res.error || "Failed to load history.", variant: "destructive" });
        setHistory([]);
        return;
      }
      const payload = res.data || {};
      const rowsRaw = Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [];
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
  }, [filters, page, toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

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
    setFilters({ from: "", to: "", change_type: "", source_type: "", project_id: "", inventory_id: "", user_id: "" });
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
          <h1 className="text-3xl font-bold tracking-tight">Inventory History</h1>
          <p className="text-muted-foreground mt-2">Audit trail of inventory movements, updates, and adjustments.</p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {loadingSummary ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading summary...</CardContent></Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Total Events</div>
                <div className="text-2xl font-semibold">{overall.total_events ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Stock In</div>
                <div className="text-2xl font-semibold">{overall.total_stock_in ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Stock Out</div>
                <div className="text-2xl font-semibold">{overall.total_stock_out ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Items Affected</div>
                <div className="text-2xl font-semibold">{overall.unique_items ?? overall.items_affected ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Active Users</div>
                <div className="text-2xl font-semibold">{overall.unique_users ?? 0}</div>
              </CardContent>
            </Card>
          </>
        )}
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
          <Input
            className="w-[160px]"
            placeholder="Inventory ID"
            value={filters.inventory_id}
            onChange={(e) => updateFilter("inventory_id", e.target.value)}
          />
          <Input
            className="w-[220px]"
            placeholder="User ID"
            value={filters.user_id}
            onChange={(e) => updateFilter("user_id", e.target.value)}
          />
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
          <Select value={filters.source_type || "all"} onValueChange={(value) => updateFilter("source_type", value === "all" ? "" : value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Source Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="dc">DC</SelectItem>
              <SelectItem value="po">PO</SelectItem>
              <SelectItem value="pr">PR</SelectItem>
              <SelectItem value="sample">Sample</SelectItem>
              <SelectItem value="mir">MIR</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.project_id || "all"} onValueChange={(value) => updateFilter("project_id", value === "all" ? "" : value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.project_id || project.id} value={String(project.project_id || project.id)}>
                  {project.project_name || project.name || `Project ${project.project_id || project.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stock In</TableHead>
                <TableHead>Stock Out</TableHead>
                <TableHead>Balance After</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Performed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading history...</TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No history records found.</TableCell>
                </TableRow>
              ) : (
                history.map((row) => (
                  <TableRow key={row.history_id || `${row.inventory_id}-${row.created_at}`}>
                    <TableCell className="text-xs">{formatDateTime(row.created_at)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{row.item_name || row.name || "-"}</div>
                      <div className="text-xs text-muted-foreground">{row.item_brand || row.brand || "-"}</div>
                    </TableCell>
                    <TableCell>{changeTypeBadge(row.change_type)}</TableCell>
                    <TableCell>{Number(row.stock_in) === 0 ? "-" : row.stock_in ?? "-"}</TableCell>
                    <TableCell>{Number(row.stock_out) === 0 ? "-" : row.stock_out ?? "-"}</TableCell>
                    <TableCell>{row.balance_after ?? "-"}</TableCell>
                    <TableCell className="text-xs">{row.source_type ? `${row.source_type.toUpperCase()}: ${row.source_ref || "-"}` : "-"}</TableCell>
                    <TableCell className="text-xs">{row.performed_by_name || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">{pageLabel}</div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={!pagination.has_prev || page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!pagination.has_next}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
