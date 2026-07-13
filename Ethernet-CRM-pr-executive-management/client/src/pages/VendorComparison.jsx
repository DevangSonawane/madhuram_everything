import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useResolvedProject } from "@/hooks/useResolvedProject";
import { useToast } from "@/hooks/use-toast";
import { RowActionsMenu } from "@/components/RowActionsMenu";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const formatPrice = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return CURRENCY_FORMATTER.format(parsed);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const getLowestRate = (offers = []) => {
  const rates = offers.map((offer) => Number(offer?.rate)).filter((rate) => Number.isFinite(rate));
  if (rates.length === 0) return null;
  return Math.min(...rates);
};

const normalizeList = (payload) => {
  let current = payload;
  for (let depth = 0; depth < 4; depth += 1) {
    if (Array.isArray(current)) return current;
    if (!current || typeof current !== "object") return [];
    if (Array.isArray(current.data)) return current.data;
    if (Array.isArray(current.rows)) return current.rows;
    if (Array.isArray(current.result)) return current.result;
    if (Array.isArray(current.results)) return current.results;
    if (Array.isArray(current.comparisons)) return current.comparisons;
    current = current.data;
  }
  return [];
};

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
  }
  return fallback;
};

const getPricelistRows = (comparison) => {
  if (!comparison || typeof comparison !== "object") return [];
  return (
    parseArrayLike(comparison.pricelist, null) ??
    parseArrayLike(comparison.price_list, null) ??
    parseArrayLike(comparison.priceList, null) ??
    parseArrayLike(comparison.items, null) ??
    []
  );
};

const getUploadDocuments = (comparison) => {
  if (!comparison || typeof comparison !== "object") return [];
  return (
    parseArrayLike(comparison.upload_document, null) ??
    parseArrayLike(comparison.upload_documents, null) ??
    parseArrayLike(comparison.uploadDocument, null) ??
    []
  );
};

const getComparisonId = (comparison) =>
  comparison?.id ?? comparison?.comparison_id ?? comparison?.vendor_comparison_id ?? comparison?.comparisonId ?? null;

const getVendorName = (row) => String(row?.vendor_name ?? row?.vendorName ?? row?.vendor ?? "").trim();
const getItemDescription = (row) =>
  String(row?.item_description ?? row?.itemDescription ?? row?.description ?? row?.item_name ?? "").trim();
const getApprovedVendorName = (comparison) =>
  (() => {
    const explicitName = String(comparison?.approved_vendor_name ?? comparison?.approvedVendorName ?? "").trim();
    if (explicitName) return explicitName;
    const fallback = String(comparison?.approved_vendor ?? "").trim();
    if (!fallback) return "";
    return /^\d+$/.test(fallback) ? "" : fallback;
  })();
const normalizeVendorKey = (value) =>
  String(value ?? "")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
const getVendorId = (vendor) => {
  const rawId = vendor?.vendor_id ?? vendor?.id ?? null;
  if (rawId === null || rawId === undefined || rawId === "") return null;
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toPositiveInteger = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const buildVendorLookupMap = (vendors = []) => {
  const map = new Map();
  (Array.isArray(vendors) ? vendors : []).forEach((vendor) => {
    const name = String(vendor?.vendor_name ?? vendor?.vendorName ?? vendor?.name ?? "").trim();
    const vendorId = getVendorId(vendor);
    if (name) map.set(normalizeVendorKey(name), { vendor_id: vendorId, vendor_name: name });
    if (vendorId !== null) map.set(String(vendorId), { vendor_id: vendorId, vendor_name: name });
  });
  return map;
};

export default function VendorComparison({ inLayout = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const resolvedProject = useResolvedProject();
  const { toast } = useToast();
  const API_BASE_URL = useMemo(
    () => String(import.meta.env.VITE_API_BASE_URL || "https://api.madhuram.enterprises").replace(/\/$/, ""),
    []
  );
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [groups, setGroups] = useState([]);
  const [resultCount, setResultCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [approvingById, setApprovingById] = useState({});
  const [deletingById, setDeletingById] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  const fetchComparisons = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const params = {};
        const fallbackProjectId = projectId ? Number(projectId) : null;
        if (resolvedProject.projectId) params.project_id = Number(resolvedProject.projectId);
        else if (Number.isFinite(fallbackProjectId) && fallbackProjectId) params.project_id = fallbackProjectId;
        const result = await api.listVendorComparisons(params);
        if (!result?.success) {
          setError(result?.error || "Unable to load comparison data.");
          setGroups([]);
          setResultCount(0);
          setGroupCount(0);
          return;
        }

        const list = normalizeList(result.data);
        setGroups(list);
        setResultCount(list.length);
        setGroupCount(list.length);
        setLastUpdated(new Date());

        // Some list responses omit pricelist; hydrate a small batch so approval ticks can render.
        const toHydrate = list
          .filter((row) => {
            const id = getComparisonId(row);
            if (id == null || id === "") return false;
            const pricelist = getPricelistRows(row);
            return pricelist.length === 0;
          })
          .slice(0, 25)
          .map((row) => getComparisonId(row));

        if (toHydrate.length > 0) {
          Promise.allSettled(toHydrate.map((id) => api.getVendorComparisonById(id)))
            .then((results) => {
              const updates = new Map();
              results.forEach((entry, index) => {
                const id = toHydrate[index];
                if (!entry || entry.status !== "fulfilled") return;
                const res = entry.value;
                if (!res?.success) return;
                updates.set(String(id), res.data || {});
              });
              if (updates.size === 0) return;
              setGroups((prev) =>
                (Array.isArray(prev) ? prev : []).map((row) => {
                  const rowId = getComparisonId(row);
                  const hit = updates.get(String(rowId));
                  if (!hit) return row;
                  return { ...row, ...hit };
                })
              );
            })
            .catch(() => {});
        }
      } catch {
        setError("Unable to load comparison data.");
        setGroups([]);
        setResultCount(0);
        setGroupCount(0);
      } finally {
        setLoading(false);
      }
    },
    [projectId, resolvedProject.projectId]
  );

  useEffect(() => {
    fetchComparisons();
  }, [fetchComparisons]);

  const sortedGroups = useMemo(() => {
    const term = String(debouncedSearchText || "").toLowerCase();
    const filtered = term
          ? groups.filter((comparison) => {
          const pricelist = getPricelistRows(comparison);
          const vendors = Array.from(new Set(pricelist.map((row) => getVendorName(row)).filter(Boolean)));
          const approvedVendor = getApprovedVendorName(comparison) || (vendors.length === 1 ? vendors[0] : "");
          const items = Array.from(new Set(pricelist.map((row) => getItemDescription(row)).filter(Boolean)));
          const hay = [
            comparison?.id,
            comparison?.pr_no,
            approvedVendor,
            ...(vendors || []),
            ...(items || []),
          ]
            .map((value) => String(value ?? "").toLowerCase())
            .filter(Boolean);
          return hay.some((value) => value.includes(term));
        })
      : groups;

    return [...filtered].sort((a, b) => {
      const aNo = Number(a?.pr_no ?? 0);
      const bNo = Number(b?.pr_no ?? 0);
      if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) return bNo - aNo;
      const aId = Number(a?.id ?? 0);
      const bId = Number(b?.id ?? 0);
      if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) return bId - aId;
      return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
    });
  }, [debouncedSearchText, groups]);

  const isStandalone = !inLayout && location.pathname.startsWith("/vendor-comparison");
  const containerClass = isStandalone
    ? "content-shell px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8"
    : "space-y-6";
  const deleteLabel = deleteTarget?.pr_no ?? deleteTarget?.pr_number ?? getComparisonId(deleteTarget) ?? "";

  const handleApproveVendor = async (comparison, vendorName) => {
    const id = getComparisonId(comparison);
    if (id == null || id === "") return;
    if (approvingById[String(id)]) return;

    const vendorResult = await api.getVendors();
    if (!vendorResult?.success) {
      toast({
        title: "Vendor lookup failed",
        description: vendorResult?.error || "Unable to load vendor IDs.",
        variant: "destructive",
      });
      return;
    }
    const vendorLookupMap = buildVendorLookupMap(parseArrayLike(vendorResult.data, []));
    const approvedVendor = vendorLookupMap.get(normalizeVendorKey(vendorName)) || null;
    if (!approvedVendor?.vendor_id) {
      toast({
        title: "Vendor not found",
        description: "The approved vendor must already exist in the vendor master list so we can send its vendor_id.",
        variant: "destructive",
      });
      return;
    }

    let pricelist = getPricelistRows(comparison);
    if (pricelist.length === 0) {
      try {
        const detail = await api.getVendorComparisonById(id);
        if (detail?.success) {
          const merged = detail.data || {};
          pricelist = getPricelistRows(merged);
          setGroups((prev) =>
            (Array.isArray(prev) ? prev : []).map((row) =>
              String(getComparisonId(row)) === String(id) ? { ...row, ...merged } : row
            )
          );
        }
      } catch {
        // ignore
      }
    }
    const filtered = pricelist.filter((row) => getVendorName(row) === vendorName);
    if (filtered.length === 0) return;

    setApprovingById((prev) => ({ ...prev, [String(id)]: true }));
    try {
      const projectIdValue = toPositiveInteger(comparison?.project_id ?? resolvedProject.projectId ?? projectId);
      const prNoValue = toPositiveInteger(comparison?.pr_no ?? comparison?.pr_number ?? comparison?.prNo ?? null);
      const payload = {
        project_id: projectIdValue,
        pr_no: prNoValue,
        approved_vendor: approvedVendor.vendor_id,
        pricelist: filtered.map((row) => ({
          vendor_id: approvedVendor.vendor_id,
          vendor_name: approvedVendor.vendor_name || vendorName,
          item_description: getItemDescription(row),
          total_qty: toNumberOrNull(row?.total_qty ?? row?.qty ?? row?.quantity),
          rate: toNumberOrNull(row?.rate),
          amount: toNumberOrNull(row?.amount),
        })),
      };
      const result = await api.updateVendorComparison(id, payload);
      if (!result?.success) {
        toast({
          title: "Approval failed",
          description: result?.error || "Unable to save vendor approval.",
          variant: "destructive",
        });
        return;
      }

      setGroups((prev) =>
          (Array.isArray(prev) ? prev : []).map((row) =>
          String(getComparisonId(row)) === String(id)
            ? {
                ...row,
                pricelist: payload.pricelist,
                approved_vendor: approvedVendor.vendor_id,
                approved_vendor_name: vendorName,
              }
            : row
        )
      );
      toast({
        title: "Saved",
        description: `Approved vendor: ${vendorName}`,
      });
    } catch (e) {
      toast({
        title: "Approval failed",
        description: e?.message || "Unable to save vendor approval.",
        variant: "destructive",
      });
    } finally {
      setApprovingById((prev) => ({ ...prev, [String(id)]: false }));
    }
  };

  const handleDeleteComparison = async (comparison) => {
    const id = getComparisonId(comparison);
    if (id == null || id === "") return;
    if (deletingById[String(id)]) return;
    setDeleteTarget(comparison);
  };

  const confirmDeleteComparison = async () => {
    const comparison = deleteTarget;
    const id = getComparisonId(comparison);
    if (id == null || id === "") {
      setDeleteTarget(null);
      return;
    }
    if (deletingById[String(id)]) return;

    const label = comparison?.pr_no ?? comparison?.pr_number ?? id;

    setDeletingById((prev) => ({ ...prev, [String(id)]: true }));
    try {
      const result = await api.deleteVendorComparison(id);
      if (!result?.success) {
        toast({
          title: "Delete failed",
          description: result?.error || "Unable to delete vendor comparison.",
          variant: "destructive",
        });
        return;
      }

      setExpandedId((prev) => (String(prev) === String(id) ? null : prev));
      setGroups((prev) => (Array.isArray(prev) ? prev.filter((row) => String(getComparisonId(row)) !== String(id)) : []));
      setResultCount((prev) => Math.max(0, prev - 1));
      setGroupCount((prev) => Math.max(0, prev - 1));
      toast({
        title: "Deleted",
        description: `Vendor comparison ${label} deleted.`,
      });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e?.message || "Unable to delete vendor comparison.",
        variant: "destructive",
      });
    } finally {
      setDeletingById((prev) => {
        const next = { ...prev };
        delete next[String(id)];
        return next;
      });
    }
  };

  const handleNewVendorComparison = () => {
    const targetProjectId = resolvedProject.projectId || projectId;
    if (targetProjectId) {
      navigate(`/${targetProjectId}/vendor-comparison/new`);
      return;
    }
    navigate("/vendor-comparison/new");
  };

  return (
    <div className={containerClass}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Comparison</h1>
          <p className="text-muted-foreground mt-2">
            Review vendor comparison uploads, approve a single vendor, and then generate POs from approved offers.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <Button onClick={handleNewVendorComparison} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> New Vendor Comparison
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Search by PR no, vendor, item, or approved vendor.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="pl-9"
              placeholder="Search by item name, product name, code, category, HSN, size..."
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading comparison results...
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && sortedGroups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No vendor comparisons found.
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && sortedGroups.length > 0
        ? (
          <Card>
            <CardHeader>
              <CardTitle>Comparisons</CardTitle>
              <CardDescription>All vendor comparisons (table view). Click “View” to expand.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">PR No</TableHead>
                      <TableHead className="min-w-[220px]">PR Name</TableHead>
                      <TableHead className="whitespace-nowrap">Comparison ID</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Vendors</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Items</TableHead>
                      <TableHead className="whitespace-nowrap">Uploaded</TableHead>
                      <TableHead className="whitespace-nowrap">File</TableHead>
                      <TableHead className="whitespace-nowrap">Approved</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedGroups.map((group, groupIndex) => {
                      const pricelist = getPricelistRows(group);
                      const vendors = Array.from(new Set(pricelist.map((row) => getVendorName(row)).filter(Boolean)));
                      const approvedVendorName = getApprovedVendorName(group) || (vendors.length === 1 ? vendors[0] : "");
                      const itemGroups = pricelist.reduce((acc, row) => {
                        const key = getItemDescription(row) || "Unnamed Item";
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(row);
                        return acc;
                      }, {});
                      const itemNames = Object.keys(itemGroups);
                      const id = getComparisonId(group);
                      const rowKey = `${id || "comparison"}-${groupIndex}`;
                      const expandKey = id != null && id !== "" ? String(id) : rowKey;
                      const isExpanded = String(expandedId || "") !== "" && String(expandedId) === String(expandKey);
                      const docs = getUploadDocuments(group);
                      const firstDoc = docs[0] || null;
                      const fileUrl = firstDoc?.file_url || firstDoc?.url || "";
                      const fileName = firstDoc?.file_name || firstDoc?.name || "";
                      const absoluteFileUrl = fileUrl
                        ? String(fileUrl).startsWith("http")
                          ? fileUrl
                          : `${API_BASE_URL}${fileUrl}`
                        : "";

                      return (
                        <React.Fragment key={rowKey}>
                          <TableRow>
                            <TableCell className="whitespace-nowrap">{group?.pr_no ?? "-"}</TableCell>
                            <TableCell>{group?.pr_name ?? "-"}</TableCell>
                            <TableCell className="whitespace-nowrap">{id ?? "-"}</TableCell>
                            <TableCell className="text-right">{vendors.length}</TableCell>
                            <TableCell className="text-right">{itemNames.length}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDateTime(group?.created_at || group?.uploaded_at || group?.updated_at)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {absoluteFileUrl ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => window.open(absoluteFileUrl, "_blank", "noopener,noreferrer")}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  {fileName ? "Open" : "File"}
                                </Button>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {approvedVendorName ? <Badge className="bg-emerald-600 text-white">{approvedVendorName}</Badge> : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setExpandedId(isExpanded ? null : expandKey)}
                                >
                                  {isExpanded ? "Hide" : "View"}
                                </Button>
                                <RowActionsMenu
                                  disabled={Boolean(deletingById[String(id)])}
                                  items={[
                                    { key: "delete", label: "Delete", icon: Trash2, destructive: true, onSelect: () => handleDeleteComparison(group) },
                                  ]}
                                />
                              </div>
                            </TableCell>
                          </TableRow>

                          {isExpanded ? (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/20">
                                <div className="space-y-4 py-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">Vendors: {vendors.length}</Badge>
                                    <Badge variant="outline">Items: {itemNames.length}</Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-sm text-muted-foreground mr-2">Approve vendor:</div>
                                    {vendors.length === 0 ? (
                                      <div className="text-sm text-muted-foreground">No vendors in pricelist.</div>
                                    ) : (
                                      vendors.map((vendorName) => {
                                        const isApproved = approvedVendorName && approvedVendorName === vendorName;
                                        const isSaving = Boolean(approvingById[String(id)]);
                                        return (
                                          <Button
                                            key={`${id || "comparison"}-${vendorName}`}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={isSaving || (approvedVendorName && approvedVendorName !== vendorName)}
                                            onClick={() => handleApproveVendor(group, vendorName)}
                                            className="gap-2"
                                          >
                                            {isSaving ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : isApproved ? (
                                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            ) : (
                                              <Circle className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span>{vendorName}</span>
                                            {isApproved ? <Badge className="bg-emerald-600 text-white">Approved</Badge> : null}
                                          </Button>
                                        );
                                      })
                                    )}
                                  </div>

                                  {itemNames.length === 0 ? (
                                    <div className="py-6 text-center text-muted-foreground">
                                      No pricelist rows for this comparison.
                                    </div>
                                  ) : (
                                    itemNames.map((itemName) => {
                                      const offers = Array.isArray(itemGroups[itemName]) ? itemGroups[itemName] : [];
                                      const sortedOffers = [...offers].sort((a, b) => {
                                        const aRate = Number(a?.rate);
                                        const bRate = Number(b?.rate);
                                        if (!Number.isFinite(aRate) && !Number.isFinite(bRate)) return 0;
                                        if (!Number.isFinite(aRate)) return 1;
                                        if (!Number.isFinite(bRate)) return -1;
                                        return aRate - bRate;
                                      });
                                      const lowestRate = getLowestRate(sortedOffers);

                                      return (
                                        <div key={`${id || "comparison"}-${itemName}`} className="rounded-md border bg-background p-3">
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                                            <div className="font-semibold">{itemName}</div>
                                            <div className="flex items-center gap-2">
                                              <Badge variant="outline">Offers: {sortedOffers.length}</Badge>
                                              <Badge variant="outline">Lowest rate: {formatPrice(lowestRate)}</Badge>
                                            </div>
                                          </div>
                                          <div className="overflow-auto rounded-md border">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead>Vendor</TableHead>
                                                  <TableHead className="text-right">Qty</TableHead>
                                                  <TableHead>Unit</TableHead>
                                                  <TableHead className="text-right">Rate</TableHead>
                                                  <TableHead className="text-right">Amount</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {sortedOffers.length === 0 ? (
                                                  <TableRow>
                                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                      No offers for this item.
                                                    </TableCell>
                                                  </TableRow>
                                                ) : (
                                                  sortedOffers.map((offer, offerIndex) => {
                                                    const rate = Number(offer?.rate);
                                                    const isLowest =
                                                      Number.isFinite(rate) && Number.isFinite(lowestRate) && rate === lowestRate;
                                                    const offerVendorName = getVendorName(offer);
                                                    const isApprovedVendor = approvedVendorName && approvedVendorName === offerVendorName;
                                                    return (
                                                      <TableRow
                                                        key={`${offerVendorName || "vendor"}-${offerIndex}`}
                                                        className={isLowest ? "bg-emerald-50/70" : ""}
                                                      >
                                                        <TableCell>
                                                          <div className="font-medium flex items-center gap-2">
                                                            <span>{offerVendorName || "-"}</span>
                                                            {isApprovedVendor ? (
                                                              <Badge className="bg-emerald-600 text-white">Approved</Badge>
                                                            ) : null}
                                                          </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">{offer?.total_qty ?? "-"}</TableCell>
                                                        <TableCell>{offer?.unit || "-"}</TableCell>
                                                        <TableCell className={`text-right font-semibold ${isLowest ? "text-emerald-700" : ""}`}>
                                                          {formatPrice(offer?.rate)}
                                                        </TableCell>
                                                        <TableCell className="text-right">{formatPrice(offer?.amount)}</TableCell>
                                                      </TableRow>
                                                    );
                                                  })
                                                )}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
        : null}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete vendor comparison?</DialogTitle>
            <DialogDescription>
              This will permanently remove comparison {deleteLabel ? `#${deleteLabel}` : "record"} and its approved vendor
              data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
            Use Cancel if you only meant to review the comparison.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={Boolean(deleteTarget && deletingById[String(getComparisonId(deleteTarget))])}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteComparison}
              disabled={!deleteTarget || Boolean(deletingById[String(getComparisonId(deleteTarget))])}
            >
              {deleteTarget && deletingById[String(getComparisonId(deleteTarget))] ? "Deleting..." : "Delete comparison"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
