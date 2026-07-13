import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/useProject';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function QuotesSearch({ inLayout = false }) {
  const navigate = useNavigate();
  const { selectedProject } = useProject();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchTimerRef = useRef(null);

  const runSearch = useCallback(async (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      setItems([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const projectId = selectedProject?.project_id || selectedProject?.id || null;
      const res = await api.searchInventoryTrace({
        q: trimmed,
        project_id: projectId ?? undefined,
      });
      if (res.success) {
        const list = Array.isArray(res.data?.items) ? res.data.items : Array.isArray(res.data) ? res.data : [];
        const deduped = Array.from(
          new Map(list.map((row) => [row.inventory_id || `${row.name}-${row.brand}`, row])).values()
        );
        setItems(deduped);
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  const openHistory = (item) => {
    const inventoryId = item?.inventory_id || item?.id;
    if (!inventoryId) return;
    navigate(`/projects/inventory/${inventoryId}/history`);
  };

  return (
    <div className={inLayout ? "space-y-6" : "content-shell px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8 space-y-6"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search Inventory</h1>
          <p className="text-muted-foreground mt-2">Search inventory items and verify their source chain.</p>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => navigate(-1)}
          type="button"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Type an item name to search inventory.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search inventory..."
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                clearTimeout(searchTimerRef.current);
                searchTimerRef.current = setTimeout(() => runSearch(value), 350);
              }}
            />
            {loading ? <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="min-w-[220px]">Item</TableHead>
                  <TableHead className="min-w-[140px]">Brand</TableHead>
                  <TableHead className="min-w-[100px]">Unit</TableHead>
                  <TableHead className="min-w-[80px] text-right">Qty</TableHead>
                  <TableHead className="min-w-[120px] text-right">Price</TableHead>
                  <TableHead className="min-w-[160px]">Project</TableHead>
                  <TableHead className="min-w-[240px]">Source Chain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!searched ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Start typing to search inventory.
                    </TableCell>
                  </TableRow>
                ) : loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Searching inventory...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No items found.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow
                      key={item.inventory_id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => openHistory(item)}
                    >
                      <TableCell className="font-medium">
                        <div className="min-w-0">
                          <p className="truncate">{item.name || '-'}</p>
                          <p className="text-xs text-muted-foreground truncate">#{item.inventory_id || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{item.brand || '-'}</TableCell>
                      <TableCell>{item.units || '-'}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.available_qty ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        ₹{Number(item.price ?? item.unit_price ?? item.rate ?? item.unit_rate ?? 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        {item.project_name || (item.same_project ? 'Same project' : 'Other project')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.source_chain_label || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
