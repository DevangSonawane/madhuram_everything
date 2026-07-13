import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/useProject';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnitSelect, convertQuantity } from '@/components/forms/UnitSelect';
import { ArrowLeft, Boxes, History, PackagePlus, Search, Loader2, Pencil } from 'lucide-react';

const EMPTY_FORM = {
  brand: '',
  name: '',
  quantity: '',
  price: '',
  unit: '',
  width: '',
  height: '',
  stockin: true,
  billing: false,
  notes: '',
};

function normalizeInventory(item) {
  return {
    id: item.inventory_id || item.id,
    inventory_id: item.inventory_id || item.id,
    project_id: item.project_id,
    brand: item.brand || '',
    name: item.name || '',
    quantity: Number(item.current_quantity ?? item.quantity) || 0,
    price: Number(item.price) || 0,
    unit: item.units || item.unit || '',
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    stockin: Boolean(item.stockin),
    billing: Boolean(item.billing),
  };
}

export default function AddInventory({ fullScreen = false, inLayout = false }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedProject } = useProject();
  const { user } = useAuth();
  const projectId = selectedProject?.project_id ?? selectedProject?.id ?? null;
  const user_id = user?.user_id || user?.id || null;
  const user_name = user?.user_name || user?.name || user?.username || "";
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [billingFilter, setBillingFilter] = useState('all');
  const [rowPending, setRowPending] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editOriginalQuantity, setEditOriginalQuantity] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const result = await api.getInventories();
      if (result.success && Array.isArray(result.data)) {
        setItems(result.data.map(normalizeInventory));
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to load inventory items.',
        variant: 'destructive',
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !query ||
        (item.brand || '').toLowerCase().includes(query) ||
        (item.name || '').toLowerCase().includes(query) ||
        String(item.inventory_id || '').includes(query) ||
        String(item.project_id || '').includes(query);
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in' && item.stockin) ||
        (stockFilter === 'out' && !item.stockin);
      const matchesBilling =
        billingFilter === 'all' ||
        (billingFilter === 'billing' && item.billing) ||
        (billingFilter === 'non-billings' && !item.billing);
      return matchesSearch && matchesStock && matchesBilling;
    });
  }, [items, searchTerm, stockFilter, billingFilter]);


  const totalQuantity = useMemo(
    () => filteredItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [filteredItems],
  );

  const totalValue = useMemo(
    () =>
      filteredItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0),
    [filteredItems],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api.createInventory({
        brand: form.brand,
        name: form.name,
        quantity: Number(form.quantity),
        price: Number(form.price),
        units: form.unit,
        width: form.width === '' ? null : Number(form.width),
        height: form.height === '' ? null : Number(form.height),
        stockin: Boolean(form.stockin),
        billing: Boolean(form.billing),
        project_id: projectId,
        notes: form.notes,
        user_id,
        user_name,
      });

      if (result.success) {
        toast({ title: 'Success', description: 'Inventory item created successfully.' });
        setForm(EMPTY_FORM);
        setCreateOpen(false);
        await fetchItems();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create inventory item.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create inventory item.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const setRowBusy = (id, busy) => {
    setRowPending((prev) => {
      if (busy) return { ...prev, [id]: true };
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleStock = async (item, value) => {
    const id = item.inventory_id || item.id;
    setRowBusy(id, true);
    try {
      const result = await api.updateInventoryStockIn(id, value);
      if (result.success) {
        setItems((prev) =>
          prev.map((row) => ((row.inventory_id || row.id) === id ? normalizeInventory(result.data) : row)),
        );
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update stock status.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error?.message || 'Failed to update stock status.', variant: 'destructive' });
    } finally {
      setRowBusy(id, false);
    }
  };

  const toggleBilling = async (item, value) => {
    const id = item.inventory_id || item.id;
    setRowBusy(id, true);
    try {
      const result = await api.updateInventoryBilling(id, value);
      if (result.success) {
        setItems((prev) =>
          prev.map((row) => ((row.inventory_id || row.id) === id ? normalizeInventory(result.data) : row)),
        );
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update billing status.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error?.message || 'Failed to update billing status.', variant: 'destructive' });
    } finally {
      setRowBusy(id, false);
    }
  };

  const openEdit = async (item) => {
    const id = item.inventory_id || item.id;
    setRowBusy(id, true);
    try {
      const result = await api.getInventoryById(id);
      if (!result.success || !result.data) {
        toast({ title: 'Error', description: result.error || 'Failed to load inventory item.', variant: 'destructive' });
        return;
      }
      const normalized = normalizeInventory(result.data);
      setEditingId(id);
      setEditOriginalQuantity(normalized.quantity);
      setEditForm({
        brand: normalized.brand,
        name: normalized.name,
        quantity: String(normalized.quantity),
        price: String(normalized.price),
        unit: normalized.unit || '',
        width: normalized.width ? String(normalized.width) : '',
        height: normalized.height ? String(normalized.height) : '',
        stockin: normalized.stockin,
        billing: normalized.billing,
      });
      setEditOpen(true);
    } catch (error) {
      toast({ title: 'Error', description: error?.message || 'Failed to load inventory item.', variant: 'destructive' });
    } finally {
      setRowBusy(id, false);
    }
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!editingId) return;

    setEditSaving(true);
    try {
      const quantityNumber = Number(editForm.quantity);
      if (!Number.isFinite(quantityNumber) || quantityNumber < 0) {
        toast({ title: 'Invalid quantity', description: 'Enter a valid non-negative quantity.', variant: 'destructive' });
        return;
      }

      const enforcedStockIn = quantityNumber > 0 ? true : Boolean(editForm.stockin);

      // Per API spec: metadata via PUT, quantity via /movement.
      const result = await api.updateInventory(editingId, {
        brand: editForm.brand,
        name: editForm.name,
        price: Number(editForm.price),
        unit: editForm.unit,
        width: editForm.width === '' ? null : Number(editForm.width),
        height: editForm.height === '' ? null : Number(editForm.height),
        stockin: enforcedStockIn,
        billing: Boolean(editForm.billing),
      });

      if (!result.success) {
        toast({ title: 'Error', description: result.error || 'Failed to update inventory item.', variant: 'destructive' });
        return;
      }

      const original = Number(editOriginalQuantity);
      const hasOriginal = Number.isFinite(original);
      const diff = hasOriginal ? quantityNumber - original : 0;

      if (hasOriginal && Math.abs(diff) > 0) {
        const movement_type = diff > 0 ? 'in' : 'out';
        const movementQty = Math.abs(diff);
        const movementRes = await api.createInventoryMovement(editingId, {
          movement_type,
          quantity: movementQty,
          source_type: 'manual',
          source_ref: `Edit inventory #${editingId}`,
          project_id: projectId ? Number(projectId) : undefined,
          notes: editForm.notes || '',
          user_id,
          user_name,
        });
        if (!movementRes.success) {
          toast({
            title: 'Saved (stock not adjusted)',
            description: movementRes.error || 'Metadata saved, but stock movement failed.',
            variant: 'destructive',
          });
        }
      }

      toast({ title: 'Success', description: 'Inventory item updated.' });
      setEditOpen(false);
      setEditingId(null);
      setEditOriginalQuantity(null);
      await fetchItems();
    } catch (error) {
      toast({ title: 'Error', description: error?.message || 'Failed to update inventory item.', variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const requestRemoveItem = (item) => {
    setItemToDelete(item);
  };

  const removeItem = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete.inventory_id || itemToDelete.id;
    setRowBusy(id, true);
    try {
      const result = await api.deleteInventory(id);
      if (result.success) {
        toast({ title: 'Success', description: 'Inventory item deleted.' });
        await fetchItems();
        setItemToDelete(null);
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to delete inventory item.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error?.message || 'Failed to delete inventory item.', variant: 'destructive' });
    } finally {
      setRowBusy(id, false);
    }
  };

  const containerPadding = inLayout
    ? "px-1 sm:px-2 md:px-4"
    : "px-1 sm:px-2 md:px-4";

  return (
    <div className={`mx-auto w-full max-w-[120rem] space-y-8 ${containerPadding} pb-8 ${fullScreen ? 'pt-3' : 'pt-2'}`}>
      {!fullScreen && (
        <div className="rounded-3xl border border-border/60 bg-gradient-to-r from-background via-background to-muted/40 p-6 shadow-sm sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Badge variant="outline" className="mb-3 border-primary/30 bg-primary/5 text-primary">
                Inventory Workspace
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight">
                Add Inventory
              </h1>
              <p className="text-muted-foreground mt-1">
                Create inventory entries for your organization.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setCreateOpen(true)}>
                + Add inventory
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total Items</CardDescription>
            <CardTitle className="text-2xl">{filteredItems.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Matching current filters
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total Quantity</CardDescription>
            <CardTitle className="text-2xl">{totalQuantity}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Units across visible rows
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Inventory Value</CardDescription>
            <CardTitle className="text-2xl">₹{totalValue.toLocaleString('en-IN')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Quantity x price
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>In Stock</CardDescription>
            <CardTitle className="text-2xl">{filteredItems.filter((it) => it.stockin).length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Items currently available
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-primary" />
                  Inventory
                </CardTitle>
                <CardDescription>Showing items across all projects.</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {fullScreen ? null : (
                  <Button
                    variant="outline"
                    onClick={() => navigate('/projects/inventory/history')}
                    className="w-full sm:w-auto"
                  >
                    <History className="mr-2 h-4 w-4" /> History
                  </Button>
                )}
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search..."
                  />
                </div>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="in">In Stock</SelectItem>
                    <SelectItem value="out">Out Stock</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={billingFilter} onValueChange={setBillingFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Billing</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="non-billings">Non Billings</SelectItem>
                  </SelectContent>
                </Select>
                
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/50 bg-background/70 p-4 sm:p-5">
              {filteredItems.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  {loading ? 'Loading items...' : 'No inventory items found.'}
                </div>
              ) : (
                <div className={fullScreen ? '' : 'max-h-[720px] overflow-y-auto pr-2'}>
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold">{item.name}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {item.brand} • #{item.inventory_id}
                            </p>
                          </div>
                          {rowPending[item.id] && (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                          )}
                        </div>

                        <div className="mb-4 grid gap-3 rounded-xl border border-border/50 bg-muted/40 p-3 sm:grid-cols-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Qty</p>
                            <p className="text-sm font-semibold">{item.quantity}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Unit Price</p>
                            <p className="text-sm font-semibold">₹{item.price.toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
                            <p className="text-sm font-semibold">₹{(item.quantity * item.price).toLocaleString('en-IN')}</p>
                          </div>
                        </div>

                        <div className="mb-4 grid gap-6 xl:grid-cols-2">
                          <div className="rounded-xl border border-border/70 p-3 sm:p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">Stock</p>
                              <Badge className={item.stockin ? 'bg-emerald-600 hover:bg-emerald-600' : ''} variant={item.stockin ? 'default' : 'secondary'}>
                                {item.stockin ? 'In' : 'Out'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={item.stockin ? 'default' : 'outline'}
                                className="h-9 text-xs"
                                onClick={() => toggleStock(item, true)}
                                disabled={Boolean(rowPending[item.id]) || item.stockin}
                              >
                                In
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={!item.stockin ? 'default' : 'outline'}
                                className="h-9 text-xs"
                                onClick={() => toggleStock(item, false)}
                                disabled={Boolean(rowPending[item.id]) || !item.stockin}
                              >
                                Out
                              </Button>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/70 p-3 sm:p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">Billing</p>
                              <Badge className={item.billing ? 'bg-blue-600 hover:bg-blue-600' : ''} variant={item.billing ? 'default' : 'secondary'}>
                                {item.billing ? 'Billing' : 'Non Billings'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={item.billing ? 'default' : 'outline'}
                                className="h-9 text-xs"
                                onClick={() => toggleBilling(item, true)}
                                disabled={Boolean(rowPending[item.id]) || item.billing}
                              >
                                Billing
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={!item.billing ? 'default' : 'outline'}
                                className="h-9 text-xs"
                                onClick={() => toggleBilling(item, false)}
                                disabled={Boolean(rowPending[item.id]) || !item.billing}
                              >
                                Non Billings
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const inventoryId = item.inventory_id || item.id;
                              if (inventoryId) navigate(`/projects/inventory/${inventoryId}/history`);
                            }}
                          >
                            Track History
                          </Button>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(item)}
                              disabled={Boolean(rowPending[item.id])}
                            >
                              <Pencil className="mr-1 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => requestRemoveItem(item)}
                              disabled={Boolean(rowPending[item.id])}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[98vw] max-w-none h-[96vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
          </DialogHeader>
          <form className="flex h-full flex-col gap-6" onSubmit={handleSubmit}>
            <div className="grid flex-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Input
                    value={form.brand}
                    onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
                    placeholder="e.g. ACC"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="e.g. Cement Bag"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.quantity}
                      onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Unit</Label>
                  <UnitSelect
                    value={form.unit}
                    onValueChange={(value) =>
                      setForm((prev) => {
                        const converted = convertQuantity(prev.quantity, prev.unit, value);
                        return {
                          ...prev,
                          unit: value,
                          quantity: converted ?? prev.quantity,
                        };
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Width</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.width}
                      onChange={(event) => setForm((prev) => ({ ...prev, width: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Height</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.height}
                      onChange={(event) => setForm((prev) => ({ ...prev, height: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Stock Status</Label>
                  <Select
                    value={form.stockin ? 'in' : 'out'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, stockin: value === 'in' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Stock In</SelectItem>
                      <SelectItem value="out">Stock Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Billing Status</Label>
                  <Select
                    value={form.billing ? 'billing' : 'non-billings'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, billing: value === 'billing' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="billing">Billing In</SelectItem>
                      <SelectItem value="non-billings">Billing Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes (opening stock reason)</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    rows={3}
                    placeholder="Optional notes for opening stock"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Add Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inventory Item #{editingId}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitEdit}>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input
                value={editForm.brand}
                onChange={(event) => setEditForm((prev) => ({ ...prev, brand: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.quantity}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.price}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <UnitSelect
                value={editForm.unit}
                onValueChange={(value) =>
                  setEditForm((prev) => {
                    const converted = convertQuantity(prev.quantity, prev.unit, value);
                    return {
                      ...prev,
                      unit: value,
                      quantity: converted ?? prev.quantity,
                    };
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Width</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.width}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, width: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Height</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.height}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, height: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Stock Status</Label>
                <Select
                  value={editForm.stockin ? 'in' : 'out'}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, stockin: value === 'in' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Stock In</SelectItem>
                    <SelectItem value="out">Stock Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Billing Status</Label>
                <Select
                  value={editForm.billing ? 'billing' : 'non-billings'}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, billing: value === 'billing' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing">Billing In</SelectItem>
                    <SelectItem value="non-billings">Billing Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
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
            <Button
              variant="outline"
              onClick={() => setItemToDelete(null)}
              disabled={Boolean(itemToDelete && rowPending[itemToDelete.inventory_id || itemToDelete.id])}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={removeItem}
              disabled={Boolean(itemToDelete && rowPending[itemToDelete.inventory_id || itemToDelete.id])}
            >
              {itemToDelete && rowPending[itemToDelete.inventory_id || itemToDelete.id] ? (
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
    </div>
  );
}
