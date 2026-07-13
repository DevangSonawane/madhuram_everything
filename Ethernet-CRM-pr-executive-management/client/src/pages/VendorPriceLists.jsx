import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { vendorFlowStore } from '@/lib/vendorFlowStore';

const STATUS_VALUES = ['active', 'inactive', 'archived'];
const toTitleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export default function VendorPriceLists({ inLayout = false }) {
  const navigate = useNavigate();
  const { vendorId } = useParams();
  const location = useLocation();

  const [vendor, setVendor] = useState(null);
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vendorResult, listResult] = await Promise.all([
        api.getVendorById(vendorId),
        api.getVendorPriceLists(vendorId),
      ]);

      if (vendorResult?.success) setVendor(vendorResult.data);
      else setVendor(vendorFlowStore.getVendorById(vendorId));

      if (listResult?.success && Array.isArray(listResult.data)) setPriceLists(listResult.data);
      else setPriceLists(vendorFlowStore.listPriceLists(vendorId));
    } catch {
      setVendor(vendorFlowStore.getVendorById(vendorId));
      setPriceLists(vendorFlowStore.listPriceLists(vendorId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const totalItemsAcrossVersions = useMemo(
    () => priceLists.reduce((acc, row) => acc + Number(row.items_count || 0),
      0),
    [priceLists]
  );

  const handleStatusPatch = async (priceListId, nextStatus) => {
    try {
      const result = await api.updateVendorPriceListStatus(priceListId, nextStatus);
      if (!result.success) vendorFlowStore.updatePriceList(priceListId, { status: nextStatus });
      await loadData();
    } catch {
      vendorFlowStore.updatePriceList(priceListId, { status: nextStatus });
      await loadData();
    }
  };

  const handleDelete = async (priceListId) => {
    try {
      const result = await api.deleteVendorPriceList(priceListId);
      if (!result.success) vendorFlowStore.deletePriceList(priceListId);
      await loadData();
    } catch {
      vendorFlowStore.deletePriceList(priceListId);
      await loadData();
    }
  };

  const isStandalone = !inLayout && location.pathname.startsWith("/vendors");
  const containerClass = isStandalone
    ? "content-shell px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8"
    : "space-y-6";

  return (
    <div className={containerClass}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Price Lists</h1>
          <p className="text-muted-foreground mt-2">
            Vendor: <span className="font-medium text-foreground">{vendor?.vendor_name || `Vendor Id ${vendorId}`}</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <Button variant="outline" onClick={() => navigate(`/projects/vendors`)} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Vendor List
          </Button>
          <Button variant="outline" onClick={loadData} disabled={loading} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => navigate(`/vendors/${vendorId}/price-lists/create`)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Add Price
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Total Versions</CardDescription><CardTitle className="text-2xl">{priceLists.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Items</CardDescription><CardTitle className="text-2xl">{totalItemsAcrossVersions}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Latest Version</CardDescription><CardTitle className="text-sm">{priceLists[0]?.version_name || '-'}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Price List Versions</CardTitle>
          <CardDescription>Update status, open details, and delete versions from this table.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Version Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>File Path</TableHead>
                <TableHead>Created On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceLists.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No versions found.</TableCell></TableRow>
              ) : (
                priceLists.map((row) => (
                  <TableRow key={row.price_list_id}>
                    <TableCell>{row.price_list_id}</TableCell>
                    <TableCell>{row.version_name || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{row.status ? toTitleCase(row.status) : '-'}</Badge></TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">{row.file_path || '-'}</TableCell>
                    <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Select value={row.status || 'active'} onValueChange={(value) => handleStatusPatch(row.price_list_id, value)}>
                          <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_VALUES.map((status) => (
                              <SelectItem key={`${row.price_list_id}-${status}`} value={status}>{toTitleCase(status)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => navigate(`/vendors/${vendorId}/price-lists/${row.price_list_id}`)}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDelete(row.price_list_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
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
