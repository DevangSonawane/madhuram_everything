import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useResolvedProject } from "@/hooks/useResolvedProject";
import { useToast } from "@/hooks/use-toast";

const parseArrayLike = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  if (value && typeof value === "object") {
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.rows)) return value.rows;
    if (Array.isArray(value.results)) return value.results;
  }
  return fallback;
};

const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const getComparisonId = (comparison) =>
  comparison?.id ?? comparison?.comparison_id ?? comparison?.vendor_comparison_id ?? comparison?.comparisonId ?? null;

const getPricelistRows = (comparison) =>
  parseArrayLike(
    comparison?.pricelist ??
      comparison?.price_list ??
      comparison?.priceList ??
      comparison?.items ??
      [],
    []
  );

const getVendorName = (row) => String(row?.vendor_name ?? row?.vendorName ?? row?.vendor ?? "").trim();

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(parsed);
};

export default function VendorItems() {
  const navigate = useNavigate();
  const { projectId: routeProjectId, vendorName: routeVendorName } = useParams();
  const { toast } = useToast();
  const resolvedProject = useResolvedProject();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comparisons, setComparisons] = useState([]);
  const [query, setQuery] = useState("");

  const projectId = resolvedProject.projectId || routeProjectId || null;
  const vendorName = useMemo(() => decodeURIComponent(String(routeVendorName || "")).trim(), [routeVendorName]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!projectId) {
        setComparisons([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const result = await api.listVendorComparisons({ project_id: projectId });
        if (!result?.success) {
          setError(result?.error || "Unable to load vendor items.");
          setComparisons([]);
          return;
        }

        const list = parseArrayLike(result.data, []);
        const filtered = list
          .map((comparison) => {
            const pricelist = getPricelistRows(comparison);
            const vendorRows = vendorName
              ? pricelist.filter((row) => normalizeText(getVendorName(row)) === normalizeText(vendorName))
              : pricelist;
            return {
              comparison,
              comparisonId: getComparisonId(comparison),
              pricelist: vendorRows,
            };
          })
          .filter((entry) => entry.pricelist.length > 0);

        if (active) setComparisons(filtered);
      } catch (err) {
        if (active) {
          setError(err?.message || "Unable to load vendor items.");
          setComparisons([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [projectId, vendorName]);

  const filteredComparisons = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return comparisons;
    return comparisons.filter((entry) => {
      const comparison = entry.comparison || {};
      const hay = [
        comparison?.pr_no,
        comparison?.pr_name,
        comparison?.project_name,
        comparison?.id,
        comparison?.comparison_id,
        vendorName,
        ...entry.pricelist.map((row) => String(row?.item_description ?? row?.description ?? row?.item_name ?? "").trim()),
      ]
        .map((value) => normalizeText(value))
        .filter(Boolean);
      return hay.some((value) => value.includes(term));
    });
  }, [comparisons, query, vendorName]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vendor Items</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {vendorName ? `Items used for ${vendorName}` : "All vendor items for the project."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => navigate(routeProjectId ? `/${routeProjectId}/vendors` : projectId ? `/${projectId}/vendors` : "/vendors")} className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Vendors
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Search</CardTitle>
          <CardDescription>Search vendor items by comparison id, PR no, or item name.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search vendor items..." />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading vendor items...
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && filteredComparisons.length === 0 ? (
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardContent className="py-16 text-center text-muted-foreground">No vendor items found.</CardContent>
        </Card>
      ) : null}

      {filteredComparisons.map((entry) => {
        const comparison = entry.comparison || {};
        const comparisonId = entry.comparisonId;
        return (
          <Card key={`vendor-${comparisonId || Math.random()}`} className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Comparison {comparisonId ?? "-"}</CardTitle>
                  <CardDescription>
                    PR No: {comparison?.pr_no ?? comparison?.pr_number ?? "-"} | Project: {comparison?.project_name ?? "-"}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{entry.pricelist.length} item(s)</Badge>
                  {vendorName ? <Badge className="bg-emerald-600 text-white">{vendorName}</Badge> : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Vendor</TableHead>
                      <TableHead className="min-w-[320px]">Item</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Qty</TableHead>
                      <TableHead className="whitespace-nowrap">Unit</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Rate</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entry.pricelist.map((row, index) => (
                      <TableRow key={`${comparisonId || "vendor"}-${index}`}>
                        <TableCell className="whitespace-nowrap">{getVendorName(row) || "-"}</TableCell>
                        <TableCell className="min-w-[320px]">{row?.item_description ?? row?.description ?? row?.item_name ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{row?.total_qty ?? row?.qty ?? row?.quantity ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{row?.unit ?? row?.uom ?? row?.UOM ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatMoney(row?.rate)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatMoney(row?.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
