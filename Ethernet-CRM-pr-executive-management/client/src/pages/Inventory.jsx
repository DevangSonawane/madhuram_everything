import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProject } from '@/contexts/useProject';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { ArrowUpDown, Loader2, Pencil, RefreshCw, Search } from 'lucide-react';
import { formatCurrencyINR, formatNumberIN } from "@/lib/numberFormat";

function normalizeInventory(it) {
  return {
    id: it.inventory_id || it.id,
    inventory_id: it.inventory_id || it.id,
    project_id: it.project_id,
    brand: it.brand,
    quantity: Number(it.current_quantity ?? it.quantity) || 0,
    name: it.name,
    price: Number(it.price) || 0,
    units: it.units || it.unit || '',
    stockin: Boolean(it.stockin),
    created_at: it.created_at,
    updated_at: it.updated_at,
  };
}

const EMPTY_FORM = { brand: '', name: '', quantity: '', price: '', stockin: true };

export default function Inventory() {
  const { toast } = useToast();
  const { projectId: routeProjectId } = useParams();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id ?? selectedProject?.project_id ?? routeProjectId ?? null;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [filterStock, setFilterStock] = useState("all"); // all | in | out
  const [editItem, setEditItem] = useState(null);
  const [editOriginalQuantity, setEditOriginalQuantity] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [movementItem, setMovementItem] = useState(null);
  const [movementForm, setMovementForm] = useState({ movement_type: "adjustment", quantity: "", notes: "" });
  const [movementSaving, setMovementSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [detailBackground, setDetailBackground] = useState(null);
  const [detailHistory, setDetailHistory] = useState([]);
  const [detailSummary, setDetailSummary] = useState({ totalIn: 0, totalOut: 0, currentBalance: 0 });
  const [detailLoading, setDetailLoading] = useState(false);
  const searchTimerRef = useRef(null);
  const [page, setPage] = useState(1);
  const pageSize = 4;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (projectId) {
        res = await api.getInventoriesByProject(projectId);
      } else {
        res = await api.getInventories();
      }
      if (res.success && Array.isArray(res.data)) {
        setItems(res.data.map(normalizeInventory));
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load inventory items.", variant: "destructive" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const matchesStock =
        filterStock === 'all' ||
        (filterStock === 'in' && it.stockin === true) ||
        (filterStock === 'out' && it.stockin === false);
      return matchesStock;
    });
  }, [items, filterStock]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterStock, items.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSearchChange = useCallback(
    (value) => {
      setSearchTerm(value);
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(async () => {
        const trimmed = value.trim();
        if (!trimmed) {
          setSearching(false);
          await fetchItems();
          return;
        }
        setSearching(true);
        const res = await api.searchInventories({ q: trimmed, project_id: projectId });
        if (res.success && Array.isArray(res.data)) {
          setItems(res.data.map(normalizeInventory));
        } else {
          setItems([]);
        }
        setSearching(false);
      }, 400);
    },
    [fetchItems, projectId]
  );

  const submitAdd = async (e) => {
    e?.preventDefault();
    if (!projectId) {
      toast({ title: "Select project", description: "Choose a project first.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await api.createInventory({
        ...form,
        project_id: projectId,
      });
      if (res.success) {
        setForm(EMPTY_FORM);
        await fetchItems();
        toast({ title: "Item added", description: "Inventory item created." });
      } else {
        toast({ title: "Error", description: res.error || "Failed to add item.", variant: "destructive" });
      }
    } catch (e2) {
      toast({ title: "Error", description: e2.message || "Failed to add item.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (it) => {
    setEditItem(it);
    setEditOriginalQuantity(Number(it.quantity ?? 0));
    setForm({
      brand: it.brand || '',
      name: it.name || '',
      quantity: String(it.quantity ?? ''),
      price: String(it.price ?? ''),
      stockin: Boolean(it.stockin),
    });
  };

  const submitEdit = async (e) => {
    e?.preventDefault();
    if (!editItem) return;
    setSaving(true);
    try {
      const quantityNumber = Number(form.quantity);
      if (!Number.isFinite(quantityNumber) || quantityNumber < 0) {
        toast({ title: "Invalid quantity", description: "Enter a valid non-negative quantity.", variant: "destructive" });
        return;
      }

      const enforcedStockIn = quantityNumber > 0 ? true : Boolean(form.stockin);
      const id = editItem.inventory_id || editItem.id;

      // Per API spec: metadata via PUT, quantity via /movement.
      const res = await api.updateInventory(id, {
        brand: form.brand,
        name: form.name,
        price: Number(form.price),
        stockin: enforcedStockIn,
      });
      if (!res.success) {
        toast({ title: "Error", description: res.error || "Failed to update item.", variant: "destructive" });
        return;
      }

      const original = Number(editOriginalQuantity);
      const hasOriginal = Number.isFinite(original);
      const diff = hasOriginal ? quantityNumber - original : 0;

      if (hasOriginal && Math.abs(diff) > 0) {
        const movement_type = diff > 0 ? "in" : "out";
        const movementRes = await api.createInventoryMovement(id, {
          movement_type,
          quantity: Math.abs(diff),
          source_type: "manual",
          source_ref: `Edit inventory #${id}`,
          notes: "",
        });
        if (!movementRes.success) {
          toast({
            title: "Saved (stock not adjusted)",
            description: movementRes.error || "Metadata saved, but stock movement failed.",
            variant: "destructive",
          });
        }
      }

      setEditItem(null);
      setEditOriginalQuantity(null);
      setForm(EMPTY_FORM);
      await fetchItems();
      toast({ title: "Item updated", description: "Inventory item saved." });
    } catch (e2) {
      toast({ title: "Error", description: e2.message || "Failed to update item.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmRemoveItem = (it) => {
    setItemToDelete(it);
  };

  const removeItem = async () => {
    if (!itemToDelete) return;
    setSaving(true);
    try {
      const res = await api.deleteInventory(itemToDelete.inventory_id || itemToDelete.id);
      if (res.success) {
        await fetchItems();
        toast({ title: "Item deleted", description: "Inventory item removed." });
        setItemToDelete(null);
      } else {
        toast({ title: "Error", description: res.error || "Failed to delete item.", variant: "destructive" });
      }
    } catch (e2) {
      toast({ title: "Error", description: e2.message || "Failed to delete item.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openMovement = (it) => {
    setMovementItem(it);
    setMovementForm({ movement_type: "adjustment", quantity: "", notes: "" });
  };

  const submitMovement = async () => {
    if (!movementItem) return;
    const quantity = Number(movementForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: "Invalid quantity", description: "Enter a positive quantity.", variant: "destructive" });
      return;
    }
    setMovementSaving(true);
    try {
      const res = await api.createInventoryMovement(movementItem.inventory_id || movementItem.id, {
        movement_type: movementForm.movement_type,
        quantity,
        notes: movementForm.notes || "",
      });
      if (!res.success) {
        toast({ title: "Error", description: res.error || "Failed to update stock.", variant: "destructive" });
        return;
      }
      toast({ title: "Saved", description: "Stock updated successfully." });
      setMovementItem(null);
      await fetchItems();
      if (detailItem && (detailItem.inventory_id || detailItem.id) === (movementItem.inventory_id || movementItem.id)) {
        await loadDetail(detailItem);
      }
    } catch (error) {
      toast({ title: "Error", description: error?.message || "Failed to update stock.", variant: "destructive" });
    } finally {
      setMovementSaving(false);
    }
  };

  const summarizeHistory = (rows, fallbackBalance) => {
    const historyRows = Array.isArray(rows) ? rows : [];
    let totalIn = 0;
    let totalOut = 0;
    let currentBalance = fallbackBalance ?? 0;

    historyRows.forEach((row) => {
      const type = String(row.movement_type || row.type || row.change_type || '').toLowerCase();
      const qty = Number(row.quantity ?? row.qty ?? row.stock_in ?? row.stock_out ?? 0);
      if (type.includes('out') || type === 'stock_out') {
        totalOut += Number.isFinite(qty) ? qty : 0;
      } else if (type.includes('in') || type === 'stock_in') {
        totalIn += Number.isFinite(qty) ? qty : 0;
      } else if (type === 'adjustment') {
        totalIn += qty > 0 ? qty : 0;
        totalOut += qty < 0 ? Math.abs(qty) : 0;
      }
      const balanceAfter = row.balance_after ?? row.balanceAfter ?? row.balance;
      if (balanceAfter != null && Number.isFinite(Number(balanceAfter))) {
        currentBalance = Number(balanceAfter);
      }
    });

    return { totalIn, totalOut, currentBalance };
  };

  const loadDetail = async (it) => {
    const id = it.inventory_id || it.id;
    if (!id) return;
    setDetailLoading(true);
    try {
      const [backgroundRes, historyRes] = await Promise.all([
        api.getInventoryItemBackground(id),
        api.getInventoryItemHistory(id),
      ]);
      const background = backgroundRes.success ? backgroundRes.data : null;
      const historyPayload = historyRes.success ? historyRes.data : [];
      const historyRows = Array.isArray(historyPayload)
        ? historyPayload
        : Array.isArray(historyPayload?.data)
          ? historyPayload.data
          : [];
      setDetailBackground(background);
      setDetailHistory(historyRows);
      setDetailSummary(summarizeHistory(historyRows, it.quantity));
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = async (it) => {
    setDetailItem(it);
    setDetailOpen(true);
    await loadDetail(it);
  };

  const movementTypeBadge = (type) => {
    const normalized = String(type || '').toLowerCase();
    const map = {
      in: { label: 'IN', className: 'bg-green-100 text-green-800 border-green-300' },
      stock_in: { label: 'IN', className: 'bg-green-100 text-green-800 border-green-300' },
      out: { label: 'OUT', className: 'bg-red-100 text-red-800 border-red-300' },
      stock_out: { label: 'OUT', className: 'bg-red-100 text-red-800 border-red-300' },
      adjustment: { label: 'ADJ', className: 'bg-amber-100 text-amber-800 border-amber-300' },
    };
    const entry = map[normalized] || { label: String(type || '-'), className: '' };
    return (
      <Badge variant="outline" className={entry.className}>
        {entry.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground mt-2">Manage project-linked inventory items.</p>
          {!projectId && (
            <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">Select a project to load/save inventory.</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <Button variant="outline" size="sm" className="shrink-0" onClick={fetchItems} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Create Inventory</CardTitle>
              <CardDescription>Uses project, brand, quantity, name, price, and stock status fields.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submitAdd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Project ID</Label>
                <Input value={projectId || ""} readOnly placeholder="Select a project" />
              </div>
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Stock Status</Label>
                <Select
                  value={form.stockin ? 'in' : 'out'}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, stockin: value === 'in' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stock status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Stock In</SelectItem>
                    <SelectItem value="out">Stock Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !projectId}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Inventory Items</CardTitle>
              <CardDescription>Brand, name, quantity, price, and stock status.</CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-[280px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search brand, name, qty, price…"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-8"
                />
                {searching ? <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>
              <Select value={filterStock} onValueChange={setFilterStock}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Stock filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="in">Stock In</SelectItem>
                  <SelectItem value="out">Stock Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="w-[320px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No items found.
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-muted-foreground">{it.inventory_id}</TableCell>
                    <TableCell>{it.brand}</TableCell>
                    <TableCell>
                      <Link
                        to={projectId ? `/${projectId}/inventory/${it.inventory_id}` : `/inventory/${it.inventory_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {it.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{formatNumberIN(it.quantity, { maximumFractionDigits: 3 })}</TableCell>
                    <TableCell className="text-right">{formatCurrencyINR(it.price, { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Badge variant={it.stockin ? "default" : "outline"}>
                        {it.stockin ? "In" : "Out"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openDetail(it)}>
                          View Details
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openMovement(it)}>
                          <ArrowUpDown className="h-4 w-4 mr-2" /> Adjust Stock
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(it)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => confirmRemoveItem(it)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filtered.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {pageStart + 1}-{Math.min(pageStart + pageSize, filtered.length)} of {filtered.length}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitEdit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
                <div className="space-y-2">
                  <Label>Stock Status</Label>
                  <Select
                    value={form.stockin ? 'in' : 'out'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, stockin: value === 'in' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stock status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Stock In</SelectItem>
                      <SelectItem value="out">Stock Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!movementItem} onOpenChange={(open) => !open && setMovementItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Movement Type</Label>
              <Select
                value={movementForm.movement_type}
                onValueChange={(value) => setMovementForm((prev) => ({ ...prev, movement_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select movement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock In</SelectItem>
                  <SelectItem value="out">Stock Out</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={movementForm.quantity}
                onChange={(e) => setMovementForm((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={movementForm.notes}
                onChange={(e) => setMovementForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Reason for adjustment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMovementItem(null)} disabled={movementSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={submitMovement} disabled={movementSaving}>
              {movementSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Inventory Item</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{itemToDelete?.name || "this item"}</span>. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemToDelete(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={removeItem} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete Item"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Item Details</SheetTitle>
          </SheetHeader>
          {!detailItem ? (
            <div className="text-sm text-muted-foreground mt-4">Select an item to view details.</div>
          ) : detailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading details...
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              <div>
                <div className="text-lg font-semibold">{detailItem.name}</div>
                <div className="text-sm text-muted-foreground">{detailItem.brand}</div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">Total Stocked In</div>
                    <div className="text-lg font-semibold">{formatNumberIN(detailSummary.totalIn, { maximumFractionDigits: 3 })}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">Total Consumed</div>
                    <div className="text-lg font-semibold">{formatNumberIN(detailSummary.totalOut, { maximumFractionDigits: 3 })}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">Current Balance</div>
                    <div className="text-lg font-semibold">{formatNumberIN(detailSummary.currentBalance, { maximumFractionDigits: 3 })}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Provenance</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { label: detailBackground?.sample?.label || detailBackground?.sample?.building_name || detailBackground?.sample?.sample_id, empty: "No Sample" },
                    { label: detailBackground?.pr?.label || detailBackground?.pr?.pr_id, empty: "No PR" },
                    { label: detailBackground?.po?.label || detailBackground?.po?.order_no, empty: "No PO" },
                    { label: detailBackground?.dc?.label || detailBackground?.dc?.challan_number, empty: "No DC" },
                    { label: "Inventory", empty: "Inventory" },
                  ].map((step, idx) => (
                    <div key={`prov-${idx}`} className={`rounded-md border px-2 py-1 ${step.label ? "" : "text-muted-foreground"}`}>
                      {step.label || step.empty}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Movement History</div>
                <div className="border rounded-md overflow-hidden max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Balance After</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Performed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                            No movement history found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        detailHistory.map((row, idx) => {
                          const type = row.movement_type || row.type || row.change_type;
                          const qtyRaw = row.quantity ?? row.qty ?? row.stock_in ?? row.stock_out ?? 0;
                          const qty = formatNumberIN(qtyRaw, { maximumFractionDigits: 3 });
                          const balanceAfterRaw = row.balance_after ?? row.balanceAfter ?? row.balance ?? null;
                          const balanceAfter = balanceAfterRaw == null ? "-" : formatNumberIN(balanceAfterRaw, { maximumFractionDigits: 3 });
                          const sourceLabel = row.source_ref ? `${row.source_type || ""}: ${row.source_ref}` : row.source_type || "-";
                          const dateValue = row.created_at || row.date || row.createdAt;
                          const formattedDate = dateValue ? new Date(dateValue).toLocaleString() : "-";
                          return (
                            <TableRow key={`history-${idx}`}>
                              <TableCell className="text-xs">{formattedDate}</TableCell>
                              <TableCell>{movementTypeBadge(type)}</TableCell>
                              <TableCell>{qty}</TableCell>
                              <TableCell>{balanceAfter}</TableCell>
                              <TableCell className="text-xs">{sourceLabel}</TableCell>
                              <TableCell className="text-xs">{row.notes || "-"}</TableCell>
                              <TableCell className="text-xs">{row.performed_by_name || row.performed_by || "-"}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
