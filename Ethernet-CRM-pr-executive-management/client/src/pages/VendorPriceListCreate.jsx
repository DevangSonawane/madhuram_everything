import React, { useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { vendorFlowStore } from '@/lib/vendorFlowStore';
import { PriceListItemsManualEntry } from '@/components/forms/PriceListItemsManualEntry';
import { useAuth } from '@/contexts/useAuth';
import { useProject } from '@/contexts/useProject';

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

const emptyForm = () => ({
  upload_file: null,
  filename: '',
  file_path: '',
  items: [emptyItem()],
});


export default function VendorPriceListCreate({ inLayout = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { vendorId } = useParams();
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const { selectedProject } = useProject();

  const [form, setForm] = useState(emptyForm());
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadedItems, setUploadedItems] = useState([]);
  const [editUploaded, setEditUploaded] = useState(false);
  const [versionName, setVersionName] = useState('');

  const addItemRow = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  };

  const removeItemRow = (index) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== index) }));
  };

  const updateItem = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => {
        if (idx !== index) return item;
        return { ...item, [key]: value };
      }),
    }));
  };

  const handleUploadFile = async (selectedFile = null) => {
    const file = selectedFile || form.upload_file;
    if (!file) {
      toast({ title: 'Select a file first', variant: 'destructive' });
      return;
    }

    try {
      setUploading(true);
      const result = await api.uploadVendorPriceListFile(file, {
        vendor_id: vendorId,
        project_id: selectedProject?.id || selectedProject?.project_id,
        user_id: user?.id || user?.user_id,
        user_name: user?.name,
      });
      if (!result.success) {
        toast({ title: 'Upload failed', description: result.error || 'Could not upload file.', variant: 'destructive' });
        return;
      }

      const importedItems = Array.isArray(result.data?.imported_items)
        ? result.data.imported_items
        : [];

      setUploadedItems(importedItems);
      setForm((prev) => ({
        ...prev,
        filename: result.data?.filename || prev.filename,
        file_path: result.data?.filePath || prev.file_path,
        items: importedItems.length ? importedItems : prev.items,
      }));
      setEditUploaded(false);

      const imported = result.data?.rows_imported;
      const skipped = result.data?.rows_skipped;
      const summary = Number.isFinite(imported) || Number.isFinite(skipped)
        ? `Imported ${imported ?? 0}, skipped ${skipped ?? 0}.`
        : (result.data?.filePath || 'Inventory upload completed.');
      toast({ title: 'Upload successful', description: summary });
    } catch {
      toast({ title: 'Upload failed', description: 'Server error.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const [file] = Array.from(event.dataTransfer.files || []);
    if (!file) return;
    setForm((prev) => ({ ...prev, upload_file: file }));
    handleUploadFile(file);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((prev) => ({ ...prev, upload_file: file }));
    handleUploadFile(file);
  };

  const clearSelectedFile = () => {
    setForm((prev) => ({ ...prev, upload_file: null, filename: '', file_path: '' }));
    setUploadedItems([]);
    setEditUploaded(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const makeVersionPrefix = (vendorName) => {
    const cleanedVendorName = String(vendorName || `vendor-${vendorId}`)
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `vendor-${vendorId}`;
    const datePart = new Date().toISOString().slice(0, 10);
    return `${cleanedVendorName}-${datePart}`;
  };

  const buildAutoVersionName = async () => {
    const [vendorResult, listResult] = await Promise.all([
      api.getVendorById(vendorId).catch(() => null),
      api.getVendorPriceLists(vendorId).catch(() => null),
    ]);

    const localVendor = vendorFlowStore.getVendorById(vendorId);
    const vendorName = vendorResult?.success
      ? vendorResult.data?.vendor_name
      : localVendor?.vendor_name;
    const prefix = makeVersionPrefix(vendorName);

    const apiLists = listResult?.success && Array.isArray(listResult.data) ? listResult.data : [];
    const localLists = vendorFlowStore.listPriceLists(vendorId);
    const allLists = [...apiLists, ...localLists];
    const pattern = new RegExp(`^${prefix}-(\\d{3})$`);

    const maxSeq = allLists.reduce((max, row) => {
      const versionName = String(row?.version_name || '');
      const match = versionName.match(pattern);
      if (!match) return max;
      const value = Number(match[1]);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);

    return `${prefix}-${String(maxSeq + 1).padStart(3, '0')}`;
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      const trimmedVersionName = String(versionName || '').trim();
      const generatedVersionName = trimmedVersionName || await buildAutoVersionName();
      const payload = {
        vendor_id: Number(vendorId),
        version_name: generatedVersionName,
        status: 'active',
        ...(form.filename ? { filename: form.filename } : {}),
        ...(form.file_path ? { file_path: form.file_path } : {}),
        items: form.items,
      };

      const result = await api.createVendorPriceList(payload);
      if (!result.success) {
        vendorFlowStore.createPriceList(vendorId, payload);
        toast({ title: 'Saved locally', description: result.error || 'Could not create on server.' });
      } else {
        toast({ title: 'Created', description: 'Price list created successfully.' });
      }

      navigate(`/vendors/${vendorId}/price-lists`);
    } catch {
      vendorFlowStore.createPriceList(vendorId, payload);
      toast({ title: 'Saved locally', description: 'Server error during create.' });
      navigate(`/vendors/${vendorId}/price-lists`);
    } finally {
      setCreating(false);
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
          <h1 className="text-3xl font-bold tracking-tight">Create Price List</h1>
          <p className="text-muted-foreground mt-2">Create a new vendor price list with optional file upload.</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <Button variant="outline" onClick={() => navigate(`/vendors/${vendorId}/price-lists`)} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Price Lists
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Version Name</CardTitle>
          <CardDescription>Edit the version name before creating the price list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="version_name">Version Name</Label>
          <Input
            id="version_name"
            value={versionName}
            onChange={(event) => setVersionName(event.target.value)}
            placeholder="Auto-generated if left blank"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>Drag and drop or choose a file to upload.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm font-medium">Upload Vendor Price List</div>
            <div className="text-xs text-muted-foreground">Drag and drop or click to upload</div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Choose File'}
            </Button>
            {form.upload_file ? (
              <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <div>Selected: {form.upload_file.name}</div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    clearSelectedFile();
                  }}
                >
                  Remove File
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {uploadedItems.length > 0 && !editUploaded ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Uploaded Inventory Items</CardTitle>
                <CardDescription>Review items parsed from the Excel upload.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditUploaded(true)}
              >
                Edit Items
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Width</TableHead>
                  <TableHead>Height</TableHead>
                  <TableHead>Stock In</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Project Id</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadedItems.map((item, index) => (
                  <TableRow key={`uploaded-item-${index}`}>
                    <TableCell>{item.name || '-'}</TableCell>
                    <TableCell>{item.brand || '-'}</TableCell>
                    <TableCell>{item.quantity ?? '-'}</TableCell>
                    <TableCell>{item.units || '-'}</TableCell>
                    <TableCell>{item.price ?? '-'}</TableCell>
                    <TableCell>{item.width ?? '-'}</TableCell>
                    <TableCell>{item.height ?? '-'}</TableCell>
                    <TableCell>{item.stockin || '-'}</TableCell>
                    <TableCell>{item.billing || '-'}</TableCell>
                    <TableCell>{item.project_id ?? '-'}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{item.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <PriceListItemsManualEntry
          items={form.items}
          onAdd={addItemRow}
          onRemove={removeItemRow}
          onChange={updateItem}
          title={uploadedItems.length > 0 ? "Edit Uploaded Items" : "Manual Item Entry"}
          description={uploadedItems.length > 0 ? "Update uploaded items, then save the price list." : "Add each product line manually with clean field grouping."}
        />
      )}

      {uploadedItems.length > 0 && editUploaded ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => setEditUploaded(false)}>
            Back to Table
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(`/vendors/${vendorId}/price-lists`)} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={creating} className="w-full sm:w-auto">
          {creating ? 'Creating...' : 'Create Price List'}
        </Button>
      </div>
    </div>
  );
}
