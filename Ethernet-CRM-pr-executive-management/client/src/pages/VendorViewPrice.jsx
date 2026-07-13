import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { vendorFlowStore } from '@/lib/vendorFlowStore';

const toTitleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export default function VendorViewPrice({ inLayout = false }) {
  const navigate = useNavigate();
  const { vendorId } = useParams();
  const location = useLocation();

  const [vendor, setVendor] = useState(null);
  const [priceLists, setPriceLists] = useState([]);
  const [latestDetail, setLatestDetail] = useState(null);

  useEffect(() => {
    const load = async () => {
      const localVendor = vendorFlowStore.getVendorById(vendorId);
      try {
        const apiVendor = await api.getVendorById(vendorId);
        setVendor(apiVendor?.success && apiVendor.data ? apiVendor.data : localVendor);
      } catch {
        setVendor(localVendor);
      }

      let lists = vendorFlowStore.listPriceLists(vendorId);
      try {
        const apiLists = await api.getVendorPriceLists(vendorId);
        if (apiLists?.success && Array.isArray(apiLists.data)) {
          lists = apiLists.data;
        }
      } catch {
        // keep fallback
      }
      setPriceLists(lists);
    };

    load();
  }, [vendorId]);

  const latest = useMemo(() => (priceLists.length ? priceLists[0] : null), [priceLists]);

  useEffect(() => {
    const loadLatest = async () => {
      if (!latest?.price_list_id) {
        setLatestDetail(null);
        return;
      }

      try {
        const detail = await api.getVendorPriceListById(latest.price_list_id);
        if (detail?.success && detail.data) {
          setLatestDetail(detail.data);
          return;
        }
      } catch {
        // fallback below
      }

      setLatestDetail(vendorFlowStore.getPriceListById(vendorId, latest.price_list_id));
    };

    loadLatest();
  }, [latest, vendorId]);

  const latestItems = latestDetail?.items || [];

  const isStandalone = !inLayout && location.pathname.startsWith("/vendors");
  const containerClass = isStandalone
    ? "content-shell px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8"
    : "space-y-6";

  return (
    <div className={containerClass}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">View Price</h1>
          <p className="text-muted-foreground mt-2">Vendor: {vendor?.vendor_name || `Vendor Id ${vendorId}`}</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <Button variant="outline" onClick={() => navigate(`/projects/vendors`)} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Vendor List
          </Button>
          <Button variant="outline" onClick={() => navigate(`/vendors/${vendorId}/price-lists`)} className="w-full sm:w-auto">
            Back to Price List Page
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Price Snapshot</CardTitle>
          <CardDescription>From the most recent vendor price list.</CardDescription>
        </CardHeader>
        <CardContent>
          {!latest ? (
            <div className="text-sm text-muted-foreground">No price list found for this vendor.</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{latest.version_name || '-'}</Badge>
                <Badge variant="outline">{latest.status ? toTitleCase(latest.status) : '-'}</Badge>
                <span className="text-xs text-muted-foreground">Created: {latest.created_at ? new Date(latest.created_at).toLocaleString() : '-'}</span>
              </div>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">No item rows in latest price list.</TableCell>
                    </TableRow>
                  ) : (
                    latestItems.map((item, idx) => (
                      <TableRow key={`latest-item-${idx}`}>
                        <TableCell>{item.name || '-'}</TableCell>
                        <TableCell>{item.brand || '-'}</TableCell>
                        <TableCell>{item.quantity ?? '-'}</TableCell>
                        <TableCell>{item.units || '-'}</TableCell>
                        <TableCell>{item.price ?? '-'}</TableCell>
                        <TableCell>{item.width ?? '-'}</TableCell>
                        <TableCell>{item.height ?? '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Button onClick={() => navigate(`/vendors/${vendorId}/price-lists/${latest.price_list_id}`)}>
                <Eye className="mr-2 h-4 w-4" /> Open Pricelist View Page
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Price Lists</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {priceLists.length === 0 ? (
              <div className="text-sm text-muted-foreground">No price list records yet.</div>
            ) : (
              priceLists.map((row) => (
                <div key={row.price_list_id} className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{row.version_name || '-'}</div>
                    <div className="text-xs text-muted-foreground">{row.status ? toTitleCase(row.status) : '-'} | {row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/vendors/${vendorId}/price-lists/${row.price_list_id}`)}>
                    <Eye className="mr-2 h-4 w-4" /> Pricelist View
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
