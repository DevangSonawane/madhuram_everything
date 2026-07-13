import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { vendorFlowStore } from '@/lib/vendorFlowStore';
import { PriceListItemsManualEntry } from '@/components/forms/PriceListItemsManualEntry';

const STATUS_VALUES = ['active', 'inactive', 'archived'];
const toTitleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const emptyItem = () => ({
  name: '',
  brand: '',
  quantity: '',
  units: '',
  price: '',
  discount_percent: '',
  width: '',
  height: '',
  stockin: '',
  billing: '',
  project_id: '',
  notes: '',
});


export default function VendorPriceListView({ inLayout = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { vendorId, priceListId } = useParams();

  const [vendor, setVendor] = useState(null);
  const [priceList, setPriceList] = useState(null);
  const [versionName, setVersionName] = useState('');
  const [status, setStatus] = useState('active');
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [patching, setPatching] = useState(false);

  const loadData = async () => {
    try {
      const [vendorResult, detailResult] = await Promise.all([
        api.getVendorById(vendorId),
        api.getVendorPriceListById(priceListId),
      ]);

      if (vendorResult?.success) {
        setVendor(vendorResult.data);
      } else {
        setVendor(vendorFlowStore.getVendorById(vendorId));
      }

      if (detailResult?.success) {
        const data = detailResult.data;
        setPriceList(data);
        setVersionName(data.version_name || '');
        setStatus(data.status || 'active');
        setItems(Array.isArray(data.items) && data.items.length ? data.items : [emptyItem()]);
      } else {
        const local = vendorFlowStore.getPriceListById(vendorId, priceListId);
        setPriceList(local);
        setVersionName(local?.version_name || '');
        setStatus(local?.status || 'active');
        setItems(Array.isArray(local?.items) && local.items.length ? local.items : [emptyItem()]);
      }
    } catch {
      const local = vendorFlowStore.getPriceListById(vendorId, priceListId);
      setVendor(vendorFlowStore.getVendorById(vendorId));
      setPriceList(local);
      setVersionName(local?.version_name || '');
      setStatus(local?.status || 'active');
      setItems(Array.isArray(local?.items) && local.items.length ? local.items : [emptyItem()]);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, priceListId]);

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, idx) => idx !== index));
  const updateItem = (index, key, value) => {
    setItems((prev) => prev.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, [key]: value };
    }));
  };

  const handlePatchStatus = async () => {
    if (!priceList?.price_list_id) return;
    try {
      setPatching(true);
      const result = await api.updateVendorPriceListStatus(priceList.price_list_id, status);
      if (!result.success) {
        vendorFlowStore.updatePriceList(priceList.price_list_id, { status });
        toast({ title: 'Status saved locally', description: result.error || 'Could not update on server.' });
      } else {
        toast({ title: 'Status updated' });
      }
      await loadData();
    } finally {
      setPatching(false);
    }
  };

  const handlePutUpdate = async () => {
    if (!priceList?.price_list_id) return;

    const payload = {
      version_name: versionName,
      status,
      items,
    };

    try {
      setSaving(true);
      const result = await api.updateVendorPriceList(priceList.price_list_id, payload);
      if (!result.success) {
        vendorFlowStore.updatePriceList(priceList.price_list_id, payload);
        toast({ title: 'Updated locally', description: result.error || 'Could not update on server.' });
      } else {
        toast({ title: 'Updated', description: 'Price list updated successfully.' });
      }
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const isStandalone = !inLayout && location.pathname.startsWith("/vendors");
  const containerClass = isStandalone
    ? "content-shell px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8"
    : "space-y-6";

  if (!priceList) {
    return (
      <div className={containerClass}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Price List Detail</h1>
            <p className="text-muted-foreground mt-2">Vendor: {vendor?.vendor_name || `Vendor Id ${vendorId}`}</p>
          </div>
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
            <Button variant="outline" onClick={() => navigate(`/vendors/${vendorId}/price-lists`)} className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Price list not found.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Price List Detail</h1>
          <p className="text-muted-foreground mt-2">Vendor: {vendor?.vendor_name || `Vendor Id ${vendorId}`}</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <Button variant="outline" onClick={() => navigate(`/projects/vendors`)} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Vendor List
          </Button>
          <Button variant="outline" onClick={() => navigate(`/vendors/${vendorId}/price-lists`)} className="w-full sm:w-auto">
            Price List Page
          </Button>
          <Button variant="outline" onClick={loadData} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" /> Reload
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Price List Id: {priceList.price_list_id}</Badge>
        <Badge variant="outline">Vendor Id: {priceList.vendor_id}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Header Fields</CardTitle>
          <CardDescription>Edit version details and save changes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Version Name</Label>
              <Input value={versionName} onChange={(e) => setVersionName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_VALUES.map((statusValue) => <SelectItem key={statusValue} value={statusValue}>{toTitleCase(statusValue)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">File Path: {priceList.file_path || '-'}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePatchStatus} disabled={patching}>{patching ? 'Updating...' : 'Update Status'}</Button>
            <Button onClick={handlePutUpdate} disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'} </Button>
          </div>
        </CardContent>
      </Card>

      <PriceListItemsManualEntry
        items={items}
        onAdd={addItem}
        onRemove={removeItem}
        onChange={updateItem}
        title="Manual Item Entry"
        description="Update each line item in a form-based layout, then save changes."
      />
    </div>
  );
}
